/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

module.metadata = {
  'stability': 'experimental'
};

const { CC, Cc, Ci, Cr } = require('chrome');

// Define Constructors
const nsIFileOutputStream = CC('@mozilla.org/network/file-output-stream;1', 'nsIFileOutputStream', 'init');
const nsIBinaryOutputStream = CC('@mozilla.org/binaryoutputstream;1', 'nsIBinaryOutputStream', 'setOutputStream');
const nsIBinaryInputStream = CC('@mozilla.org/binaryinputstream;1', 'nsIBinaryInputStream', 'setInputStream');
const nsIFilePicker = CC('@mozilla.org/filepicker;1', 'nsIFilePicker'); // https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIFilePicker
const nsIStorageStream = CC('@mozilla.org/storagestream;1', 'nsIStorageStream', 'init');
const nsILocalFile = CC('@mozilla.org/file/local;1', 'nsILocalFile'); // https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsILocalFile#initWithPath%28%29

// Instantiate Services
const windowMediator = Cc['@mozilla.org/appshell/window-mediator;1'].getService(Ci.nsIWindowMediator); // https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIWindowMediator
const dirSvc = Cc['@mozilla.org/file/directory_service;1'].getService(Ci.nsIProperties);
const ioService = Cc['@mozilla.org/network/io-service;1'].getService(Ci.nsIIOService); // https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIIOService
const appInfo = Cc['@mozilla.org/xre/app-info;1'].getService(Ci.nsIXULAppInfo); // https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIXULAppInfo

// Import SDK modules
const { Class, obscure } = require('sdk/core/heritage');
const { Unknown } = require('sdk/platform/xpcom');
const { defer } = require('sdk/core/promise');
const unload = require('sdk/system/unload');

// Other imports
const { SHA1 } = require('./crypto');
const { bencode } = require('./bencode');
const { accessor, merge, definePrivateProperty, enumToArray } = require('./utils');

// https://developer.mozilla.org/en-US/docs/PR_Open#Parameters
const PR_WRONLY = 0x02; // Open for writing only.
const PR_CREATE_FILE = 0x08; // If the file does not exist, the file is created. If the file exists, this flag has no effect.
const PR_TRUNCATE = 0x20; // If the file exists, its length is truncated to 0.

// Note: Octal literals require FF 25+
const PR_IWUSR = 0o0200; // write permission, owner
const PR_IWOTH = 0o0002; // write permission, others
const PR_IWGRP = 0o0020; // write permission, group

// DEFER_OPEN - If this is set, the file will be opened (i.e., a call to PR_Open() done) only when we do an actual operation on the stream
const { DEFER_OPEN } = Ci.nsIFileInputStream; // https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIFileInputStream#Constants

// https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsICachingChannel#Constants
const { LOAD_BYPASS_LOCAL_CACHE } = Ci.nsICachingChannel;
// https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/NsIRequest#Constants
const { LOAD_ANONYMOUS, LOAD_BYPASS_CACHE, INHIBIT_CACHING, INHIBIT_PERSISTENT_CACHING, LOAD_FRESH_CONNECTION } = Ci.nsIChannel;

/*
// Ensure that requests are canceled during unload.
const tMap = new Map();
unload.when(reason => {
    let it = tMap.keys();
    while (!it.done) {
        let request = it.next()
        if (request && typeof request.cancel === 'function')
            request.cancel();
    }
});
*/
// Create nsIStreamListener Constructor
const nsIStreamListener = Class({
    extends: Unknown,
    interfaces: [ 'nsIStreamListener' ],
    initialize: function initialize(listener) {
        if (typeof listener !== 'function')
            throw new TypeError('The "listener" argument must be a function.');
        this.listener = listener;
    },
    onStartRequest: function (aRequest, aContext) {},
    onDataAvailable: function (aRequest, aContext, aInputStream, aOffset, aCount) {
        // We must read all data available in the stream before returning from
        // this function. If we close the binary input stream it has a side 
        // effect of stopping the transfer.
        let binaryInputStream = new nsIBinaryInputStream(aInputStream);
        let bytes = binaryInputStream.readBytes(aCount);
        // We need a storage stream to create a new input stream.
        let storageStream = new nsIStorageStream(8192, aCount, null);
        // Write the data to the storage stream..
        let outputStream = storageStream.getOutputStream(0);
        let binaryOutputStream = new nsIBinaryOutputStream(outputStream);
        binaryOutputStream.writeBytes(bytes, bytes.length);
        // Close the output streams.
        binaryOutputStream.close();
        // Create a new input stream from the storage stream.
        let stream = storageStream.newInputStream(0);
        // The nsIChannel interface has the contentLength property.
        aRequest.QueryInterface(Ci.nsIChannel);
        // Callback the listener with the stream and available byte count
        // and content length in bytes. The listener is responsible for
        // closing the new input stream.
        this.listener(stream, stream.available(), aRequest.contentLength);
    },
    onStopRequest: function (aRequest, aContext, aStatusCode) {}
});

const nsIProgressEventSink = Class({
    extends: Unknown,
    interfaces: [ 'nsIProgressEventSink', 'nsIInterfaceRequestor' ],
    initialize: function (listener, statusArg) {
        if (typeof listener !== 'function')
            throw new TypeError('The "listener" argument must be a function');
        this.listener = listener;
        this.status = Ci.nsISocketTransport.STATUS_RESOLVING;
        this.statusArg = statusArg;
    },
    getInterface: function (aIID) {
        return this.QueryInterface(aIID);
    },
    onProgress: function (aRequest, aContext, aProgress, aProgressMax) {
        this.listener(this.status, this.statusArg, aProgress, aProgressMax);
    },
    onStatus: function (aRequest, aContext, aStatus, aStatusArg) {
        this.status = aStatus;
    }
});

// Default torrent object
const getTemplate = () => ({
    'created by': appInfo.vendor + ' ' + appInfo.name + ' ' + appInfo.version,
    'encoding': 'UTF-8',
    'info': {
        'length': 0,
        'name': '',
        'piece length': 0,
        'pieces': ''
    }
});

// Unique ID counter
let TID = -1;

// Class Definition
function Torrent(prototype = {}) {
    this.hasher = new SHA1();
    this.remaining = 0;
    this.total = 0;
    this.processed = 0;
    this.id = ++TID;
    // Overwrite the template properties with those in the providied prototype.
    // Assign the accumulated properties to "this".
    merge(this, getTemplate(), prototype);
}

Torrent.prototype = obscure({ // Ensure that the following methods can't be enumerated.
    updateFrom: function (source, listener) {
        let deferred = defer();
        try {
            if (this.isCanceled)
                throw new Error('The torrent request has been canceled.');
            let uri = source;
            if (source instanceof Ci.nsIFile) {
                uri = ioService.newFileURI(source);
            }
            else if (source instanceof Ci.nsIInputStream) {
                this.updateFromStream(source);
                deferred.resolve(this);
                return void(0);
            }
            else if (typeof source === 'string')
                uri = ioService.newURI(source, null, null);
            else if (!(source instanceof Ci.nsIURI))
                throw new TypeError('Invalid "source" argument.');
            let channel = this.channel = ioService.newChannelFromURI(uri);
            if (channel instanceof Ci.nsISupportsPriority)
                channel.priority = Ci.nsISupportsPriority.PRIORITY_HIGHEST;
            channel.notificationCallbacks = new nsIProgressEventSink(listener, uri.host || uri.fileName);
            channel.loadFlags = LOAD_BYPASS_LOCAL_CACHE|LOAD_ANONYMOUS|
                    LOAD_BYPASS_CACHE|INHIBIT_CACHING|
                    INHIBIT_PERSISTENT_CACHING|LOAD_FRESH_CONNECTION;
            let lengthVerified = false, self = this;
            this.total = 0;
            let onInputStreamReady = (stream, available, length) => {
                if (!lengthVerified && !this.info.length) {
                    try {
                        this.info.length = length;
                        if (!this.info['piece length'])
                            this.info['piece length'] = calcPieceLength(length);
                        lengthVerified = true;
                    } catch (exception) {
                        self.cancel();
                        deferred.reject(exception);
                        return void(0);
                    }
                }
                this.updateFromStream(stream, available);
                if (this.total === length)
                    deferred.resolve(this);
                stream.close();
            };
            let channelListener = new nsIStreamListener(onInputStreamReady);
            channel.asyncOpen(channelListener, null);
        } catch (exception) {
            this.cancel();
            deferred.reject(exception);
        }
        return deferred.promise;
    },
    updateFromStream: function (stream, available) {
        let remaining = this.remaining || this.info['piece length'];
        if (!available)
            available = stream.available();
        while (available) {
            let count = (remaining > available) ? available : remaining;
            if (count) {
                this.hasher.updateFromStream(stream, count);
                remaining -= count;
                this.total += count;
                this.processed += count;
                if (!remaining) {
                    remaining = this.info['piece length'];
                    this.info.pieces += this.hasher.digest();
                }
                this.remaining = remaining;
                available -= count;
            }
        }
    },
    cancel: function (status) {
        if (this.channel) {
            this.channel.cancel(status);
            return true;
        }
    },
    suspend: function () {
        if (this.channel) {
            this.channel.suspend();
            return true;
        }
    },
    resume: function () {
        if (this.channel && this.channel.isPending()) {
            this.channel.resume();
            return true;
        }
    },
    finish: function () {
        let needPieces = Math.ceil(this.info.length/this.info['piece length']);
        let havePieces = (this.info.pieces.length/20);
        if (needPieces !== havePieces)
            this.info.pieces += this.hasher.digest();
    },
    toString: function () {
        let orderedObj = {}
        Object.keys(this).sort().forEach(property =>
                orderedObj[property] = this[property]);
        return bencode(orderedObj);
    },
    saveToDisk: function (path) {
        let file = path;
        if (!path)
            file = dirSvc.get('DfltDwnld', Ci.nsIFile);
        else if (!(path instanceof Ci.nsIFile)) {
            file = new nsILocalFile();
            file.initWithPath(path);
        }
        try {
            if (file.isDirectory())
                file.appendRelativePath(this.info.name + '.torrent');
        } catch (error if error.result === Cr.NS_ERROR_FILE_NOT_FOUND) {}
        let ostream = new nsIFileOutputStream(file, PR_WRONLY|PR_CREATE_FILE|PR_TRUNCATE, PR_IWUSR+PR_IWGRP+PR_IWOTH, DEFER_OPEN);
        let bstream = new nsIBinaryOutputStream(ostream);
        let data = this.toString();
        bstream.writeBytes(data, data.length);
        bstream.close();
        return file;
    },
    getHash: function () {
        let data = bencode(this.info);
        return (new SHA1(data)).hexDigest();
    }
});

// Prevent these properties from being enumerated by the bencode function.
// If not for this after assignment the properties would become enumerable.
definePrivateProperty(Torrent.prototype, 'remaining');
definePrivateProperty(Torrent.prototype, 'total');
definePrivateProperty(Torrent.prototype, 'processed');
definePrivateProperty(Torrent.prototype, 'hasher');
definePrivateProperty(Torrent.prototype, 'channel');
definePrivateProperty(Torrent.prototype, 'id');

// Class Exportation
exports.Torrent = Torrent;

// Returns an Array of nsIFile(s) that are in the specified root
// directory(nsIFile) and sub directories.
const fileList = file => {
    let files = enumToArray(file.directoryEntries).
            map(file => file.QueryInterface(Ci.nsIFile));
    let list = [];
    files.forEach(file => {
        try {
            if (file.isDirectory())
                list.push.apply(list, fileList(file));
            else if (file.fileSize)
                list.push(file);
        } catch (error if error.result === Cr.NS_ERROR_FILE_NOT_FOUND) {}
    });
    return list;
};

exports.fileList = fileList;

// Returns an appropiate torrent piece size
const calcPieceLength = (totalLength, pieceLength = 0) => {
    if (pieceLength < 16384/*16KB*/) {
        if (totalLength < 16384/*16KB*/)
            throw new Error('Torrent must be larger than 16 KB.');
        else {
            pieceLength = 262144/*256KB*/;
            while (totalLength / pieceLength > 2000)
                pieceLength *= 2;
            while (totalLength / pieceLength < 8)
                pieceLength /= 2;
            return Math.max(Math.min(pieceLength, 1048576/*1MB*/), 16384/*16KB*/);
        }
    }
};

exports.calcPieceLength = calcPieceLength;

/*
 *  Creates a torrent meta data formatted file list
 *  @Param: root(nsIFile) - parent to the files
 *  @Param: files(Array) - nsIFile instances with non zero length,
 *      children of "root" file.
 *  @Return: [{length: Number, path: [String, String, ...]}, ...]
 */
const createFileList = (root, files) => {
    root = root instanceof Ci.nsIFile ? root : new nsIFile(root);
    if (!root.isDirectory())
        throw new TypeError('The "root" argument is not a valid directory.');
    let fileList = [];
    files.forEach(file => {
        let path = [file.leafName], length = file.fileSize;
        while (file.parent !== null) {
            file = file.parent;
            if (file.path === root.path) break;
            path.push(file.leafName);
        }
        path.reverse();
        fileList.push({'length':length, 'path':path});
    });
    return fileList;
};

exports.createFileList = createFileList;

const isDirectory = url => {
    let uri = ioService.newURI(url, null, null);
    try {
        uri.QueryInterface(Ci.nsIFileURL);
        return uri.file && uri.file.isDirectory();
    } catch (exception) {}
    return false;
};

exports.isDirectory = isDirectory;

/*
 *  @Summary:
 *      Creates a torrent object given a url, file, or stream.
 *
 *  @Syntax:
 *      createTorrent(options);
 *
 *  @Optional-Syntax:
 *      createTorrent(source).then(resolve, reject);
 *
 *  @Param: 
 *      options - An Object that may contain the following properties:
 *      {
 *          source: String URL, nsIURI, nsIFile, or nsIInputStream,
 *          torrent: Torrent Object to reuse if any.
 *          prototype: Object with torrent properties i.e. 'piece length',
 *          onprogress: Function to be called with (status, statusArg, progress, progressMax) arguments,
 *          onload: Function to be called with {Torrent} after completion.
 *          onerror: Function to be called with {Error} if an exception occurs.
 *      }
 *
 *  @Return: Torrent Object
 */

const createTorrent = (options = {}, prototype) => {
    // If options isn't an object then create the options object from the optional arguments.
    if (typeof options !== 'object' || options instanceof Ci.nsISupports)
        options = { source: options, prototype: prototype };
    let { torrent, source, prototype, onprogress, onload, onerror } = options;
    console.log(options);
    try {
        // If source isn't a nsIURI then create a nsIURI from source.
        let uri = null, isStream = false, file = null, multiFileMode = false;
        if (!(source instanceof Ci.nsIURI)) {
            if (source instanceof Ci.nsIFile)
                uri = ioService.newFileURI(source, null, null);
            else if (!(source instanceof Ci.nsIInputStream))
                uri = ioService.newURI(source, null, null);
            else isStream = true;
        } else uri = source;
        if (!isStream) {
            // Checks for local file.
            let isLocalFile = (uri.scheme === 'file');
            if (isLocalFile) {
                file = uri.QueryInterface(Ci.nsIFileURL).file;
                if (!file.exists())
                    throw new Error('File does not exist.');
                if ((multiFileMode = file.isDirectory()) && !file.parent)
                    throw new Error('Unable to create torrents from the root of drives.');
            }
            // Maybe create the torrent with a prototype.
            torrent = torrent || new Torrent(prototype);
            // Maybe add the url as a web seed.
            if (!isLocalFile) {
                if (!torrent['url-list'])
                    torrent['url-list'] = [ uri.spec ];
                else if (Array.isArray(torrent['url-list'])) {
                        if (!~torrent['url-list'].indexOf(uri.spec))
                            torrent['url-list'].push(uri.spec);
                }
            }
            // Maybe add the file leaf name.
            if (!torrent.info.name) {
                // File leafName or as a last resort a time stamp in milliseconds
                let leafName = '';
                if (file)
                    leafName = file.leafName;
                else if (uri.path)
                    leafName = (uri.path.match(/\/([^\/?#]+)$/i) || '')[1];
                torrent.info.name = leafName || new String(Date.now());
            }
        } // If source is an input stream then we skipped the above and landed here.
        // Set the creation date.
        if (!torrent['creation date'])
            torrent['creation date'] = Date.now() / 1000;
        // Hash the resource(s)
        if (!multiFileMode)
            torrent.updateFrom(uri || source, onprogress).then(onload, onerror);
        else {
            // Get a list of non zero byte size files relative to the directory(file).
            let files = fileList(file);
            // Update the info length property.
            torrent.info.length = torrent.info.length || 0;
            files.forEach(file => torrent.info.length += file.fileSize);
            // If the piece length hasn't been set or is invalid then update it.
            if (!torrent.info['piece length'])
                torrent.info['piece length'] = calcPieceLength(torrent.info.length);
            // Append the files to the list if its already been created or overwrite.
            if (Array.isArray(torrent.info.files))
                torrent.info.files.push.apply(null, createFileList(file, files));
            else torrent.info.files = createFileList(file, files);
            // Iterate over the files hashing each one in turn.
            let shouldStop = false, stopOnError = exception => {
                shouldStop = true;
                onerror(exception);
            };
            let iterate = () => {
                if (shouldStop)
                    torrent.cancel();
                else if (files.length)
                    torrent.updateFrom(files.shift(), onprogress).then(iterate, stopOnError);
                else if (typeof onload === 'function')
                    onload(torrent);
            };
            iterate();
        }
    }
    catch (exception) {
        torrent.cancel();
        if (typeof onerror === 'function')
            onerror(exception);
    }
    //tMap.set(torrent);
    return torrent;
};

exports.createTorrent = createTorrent;

/*
 *  @Summary: Prompts user for a local file or directory.
 *  @Syntax: 
 *          filePicker(title).then(resolve, reject);
 *          filePicker(title, true).then(resolve, reject);
 *  @Param: title(String)
 *  @Param: modeGetFolder(Boolean)
 *  @Return: promise(Object)
 */

const filePicker = (title = '', mode, suggestURI) => {
    let deferred = defer();
    try {
        // File Picker
        if (mode !== 'modeSave' && mode !== 'modeGetFolder' && mode !== 'modeOpen')
            mode = mode ? 'modeGetFolder' : 'modeOpen';
        let window = windowMediator.getMostRecentWindow('navigator:browser');
        let picker = new nsIFilePicker();
        if (mode === 'modeSave') {
            picker.appendFilter('Torrent', '*.torrent');
            picker.defaultExtension = 'torrent';
            if (suggestURI) { // Suggest a name or uri path as the file name
                try {
                    let uri = ioService.newURI(suggestURI, null, null);
                    try {
                        uri.QueryInterface(Ci.nsIFileURL);
                        let file = new nsILocalFile();
                        file.initWithFile(uri.file);
                        file.leafName = file.leafName ? file.leafName + '.torrent' : Date.now() + '.torrent';
                        file.createUnique(uri.file.NORMAL_FILE_TYPE, PR_IWUSR+PR_IWGRP+PR_IWOTH);
                        file.remove(true);
                        picker.defaultString = file.leafName;
                    }
                    catch (error) {
                        let suggestion = uri.path.substring(uri.path.lastIndexOf('/')+1, uri.path.length);
                        picker.defaultString = suggestion ? suggestion + '.torrent' : uri.host + '.torrent';
                    }
                }
                catch (error) { 
                    picker.defaultString = suggestURI + '.torrent';
                }
            }
        } else picker.appendFilters(picker.filterAllowURLs|picker.filterAll);
        picker.init(window, title, picker[mode]);
        // Upon file chosen, create torrent
        picker.open(result => {
            if (result === picker.returnOK || result === picker.returnReplace)
                deferred.resolve(picker);
            else deferred.reject(new Error('User aborted.'));
        });
    }
    catch (exception) {
        deferred.reject(exception);
    }
    return deferred.promise;
};

exports.filePicker = filePicker;