/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

module.metadata = {
  'stability': 'experimental'
};

// Import XPCOM
const CHROME = require('./xpcom');

// Define Constructors
const {
    nsIFileInputStream,
    nsIFileOutputStream,
    nsIBinaryInputStream,
    nsIBinaryOutputStream,
    nsILocalFile,
    nsIThreadManager,
    nsIStreamTransportService,
    nsIWindowMediator,
    nsIFilePicker,
    nsIConverterOutputStream,
    nsIIOService,
    nsIStorageStream,
    nsIXMLHttpRequest
} = CHROME;

// Define QI Global
const { QI } = CHROME;

// Used to access nsIProperties
const FileUtils = CHROME.FileUtils();

// Used for file stream manipulation
const NetUtil = CHROME.NetUtil();

// Define Helpers
const { isInterface, isSuccessCode } = CHROME;

// Define Errors
const { NS_ERROR_NOT_AVAILABLE, NS_ERROR_UNEXPECTED, NS_BASE_STREAM_CLOSED } = CHROME.Cr;

// Define Interfaces
const { nsISupportsPriority } = CHROME.Ci;

// Import modules
const { Class, mix, obscure } = require('sdk/core/heritage');
const { Unknown } = require('sdk/platform/xpcom');
const { SHA1 } = require('./crypto');
const { bencode } = require('./bencode');
const { accessor } = require('./utils');
const constants = require('./constants');

// Define Flags
const openFlags = constants.OPEN_UNBUFFERED;
const writeFlags = constants.PR_WRONLY | constants.PR_CREATE_FILE | constants.PR_TRUNCATE;
const behavFlags = constants.DEFER_OPEN + constants.CLOSE_ON_EOF;
const readFlags = constants.PR_RDONLY;
const permFlags = constants.PR_IRUSR + // Read User
                  constants.PR_IWUSR + // Write User
                  constants.PR_IRGRP + // Read Group
                  constants.PR_IROTH;  // Read Other

// Instantiate Services
const threadMgr = new nsIThreadManager();
const transportSrv = new nsIStreamTransportService();
const windowMediator = new nsIWindowMediator();
const ioService = new nsIIOService();

// Define Shortcuts
const currentThread = () => threadMgr.currentThread;
const createInputTransport = (...args) => transportSrv.createInputTransport(...args);
const getWindow = type => windowMediator.getMostRecentWindow(type || '');
const getFile = (file, pathArray) => FileUtils.getFile(file, pathArray || []);
const openSafeFileOutputStream = (...args) => FileUtils.openSafeFileOutputStream(...args);
const createChannel = (url, charset, baseURI) => ioService.newChannel(url, charset || null, baseURI || null);
const newURI = (url, charset, baseURI) => ioService.newURI(url, charset || null, baseURI || null);

// Returns the size in bytes of the file pointed to by URL
const remoteFileLength = (url, callback) => {
    if (typeof callback !== 'function')
        throw new TypeError('The "callback" argument must be a function.');
    let request = new nsIXMLHttpRequest();
    request.mozBackgroundRequest = true;
    request.open('HEAD', url, true);
    if (request.channel instanceof nsISupportsPriority)
        request.channel.priority = nsISupportsPriority.PRIORITY_HIGHEST;
    request.onload = () => {
        if (request.readyState === 4 && request.status === 200)
            callback(parseInt(request.getResponseHeader('Content-Length')) || 0);
        else callback(0, request.status);
    };
    request.send();
};

exports.remoteFileLength = remoteFileLength;

// Create nsIFile Constructor
function nsIFile(path) {
    let file = new nsILocalFile();
    file.initWithPath(path);
    return file;
}

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
        // this function. If we close the binary input stream it will stop
        // the transfer.
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
        // Callback the listener with the stream and available byte count.
        // The listener is responsible for closing the new input stream.
        this.listener(stream, stream.available());
    },
    onStopRequest: function (aRequest, aContext, aStatusCode) {}
});

// Create nsITransportEventSink Constructor
function nsITransportEventSink(aListener) {
    if (typeof aListener === 'function') // onTransportStatus(aStatus, aProgress, aProgressMax)
        this.onTransportStatus = (_, ...args) => aListener(...args);
}

// http://dxr.mozilla.org/mozilla-central/source/netwerk/base/public/nsIStreamTransportService.idl#11
// http://dxr.mozilla.org/mozilla-central/source/netwerk/base/public/nsITransport.idl?from=nsITransport.idl#50
// Create nsIAsyncInputStream Constructor - https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIAsyncInputStream
function nsIAsyncInputStream(aStream, aListener) {
    //createInputTransport(aStream, aStartOffset, aReadLimit, aCloseWhenDone)
    let transport = createInputTransport(aStream, -1, -1, true);
    transport.setEventSink(new nsITransportEventSink(aListener), currentThread());
    // openInputStream(aFlags, aSegmentSize, aSegmentCount)
    return QI.nsIAsyncInputStream(transport.openInputStream(openFlags, 0, 0));
}

// Converts an Enumeration to an Array
const enumToArray = (enumerator) => {
    let array = new Array();
    while (enumerator.hasMoreElements())
        array.push(enumerator.getNext());
    return array;
};

// Returns an Array of nsIFile(s) that are in the specified root directory(nsIFile) and sub directories.
const fileList = file => {
    let files = enumToArray(file.directoryEntries).map(QI.nsIFile);
    let list = [];
    files.forEach(file => {
        if (file.isDirectory())
            list.push(...fileList(file));
        else if (file.fileSize > 0)
            list.push(file);
    });
    return list;
};

exports.fileList = fileList;

// Utility function to copy object(s)'s properties to another object
// without modifying those objects. Its similar to a deep copy.
// Object property precedence is from right to left.
const merge = (...objects) => {
    if (objects.length) {
        let toObj = objects.shift(); // The first argument
        if (toObj) {
            objects.forEach(object => { // Loop through the remaing objects
                if (object) {
                    object = Object.create(object); // Create a new object that inherits from object
                    for (let property in object) {
                        if (typeof object[property] !== 'object')
                            toObj[property] = object[property];
                        else if (typeof toObj[property] === 'object')
                            merge(toObj[property], object[property]);
                        else toObj[property] = object[property];
                    }
                }
            });
        }
        return toObj;
    }
};

// Default torrent object
const getTemplate = () => ({
    'encoding': 'UTF-8',
    'info': {
        'length': 0,
        'name': '',
        'piece length': 0,
        'pieces': ''
    }
});

// Define WeakMap Accessor
const secret = accessor();

// Class Definition
function Torrent(prototype = {}) {
    // Set the key/value pair of the WeakMap.
    let defaults = secret(this, {});
    // Initialize private properties
    defaults.hasher = new SHA1();
    defaults.remaining = 0;
    defaults.processed = 0;
    // Overwrite the template properties with those in the providied prototype.
    // Assign the accumulated properties to "this".
    merge(this, getTemplate(), prototype);
}

Torrent.prototype = obscure({ // Ensure that the following methods can't be enumerated.
    updateFromStream: function (stream, available) {
        let remaining = this.remaining || this.info['piece length'];
        if (!available)
            available = stream.available();
        while (available) {
            let count = (remaining > available) ? available : remaining;
            if (count) {
                this.hasher.updateFromStream(stream, count);
                this.processed += count;
                remaining -= count;
                if (!remaining) {
                    remaining = this.info['piece length'];
                    this.info.pieces += this.hasher.digest();
                }
                this.remaining = remaining;
                available -= count;
            }
        }
    },
    updateFromFile: function (file, callback, listener) {
        let stream = new nsIFileInputStream(file, readFlags, permFlags, behavFlags);
        let asyncStream = new nsIAsyncInputStream(stream, listener);
        let onInputStreamReady = (stream) => {
            this.updateFromStream(stream);
            if (this.processed === file.fileSize) {
                 if (typeof callback === 'function')
                     callback(this);
            }
            else {
                asyncStream.asyncWait(onInputStreamReady, 0, this.info['piece length'], currentThread());
            }
        };
        asyncStream.asyncWait(onInputStreamReady, 0, this.info['piece length'], currentThread());
    },
    updateFromURL: function (url, length, callback) {
        let channel = createChannel(url);
        if (channel instanceof nsISupportsPriority)
            channel.priority = nsISupportsPriority.PRIORITY_HIGHEST;
        let onInputStreamReady = (stream, available) => {
            this.updateFromStream(stream, available);
            if (this.processed === length) {
                 if (typeof callback === 'function')
                     callback(this);
                 return void(0);
            }
            stream.close();
        };
        let channelListener = new nsIStreamListener(onInputStreamReady, callback);
        channel.asyncOpen(channelListener, null);
    },
    finish: function () {
        let needPieces = Math.ceil(this.info.length/this.info['piece length']);
        let havePieces = (this.info.pieces.length/20);
        if (needPieces !== havePieces)
            this.info.pieces += this.hasher.digest();
    },
    toString: function () {
        return bencode(this);
    },
    saveToFile: function (path) {
        let file = path;
        if (!path)
            file = getFile('DfltDwnld');
        else if (!isInterface(path, 'nsIFile'))
            file = new nsIFile(path);
        if (file.isDirectory())
            file.appendRelativePath(this.info.name + '.torrent');
        let ostream = new nsIFileOutputStream(file, writeFlags, permFlags, behavFlags);
        let bstream = new nsIBinaryOutputStream(ostream);
        //let cstream = new nsIConverterOutputStream(bstream, this.encoding, 0, 0)
        let data = this.toString();
        //cstream.writeString(data, data.length);
        //cstream.close();
        bstream.writeBytes(data, data.length);
        bstream.close();
        return file;
    },
    getHash: function () {
        let data = bencode(this.info);
        return (new SHA1(data)).hexDigest();
    }
});

// Used to define properties that are not enumerable and will remain as such
// but also allow assignment. This means that if you use this on a contructor's
// prototype then when an object is constructed with said function(contructor)
// that property will be readable and writable but not enumerable during its
// lifetime.
const privateProperty = (object, name) => {
    Object.defineProperty(object, name, {
        __proto__: null,
        get: function () {
            return secret(this)[name];
        },
        set: function (value) {
            secret(this)[name] = value;
        }
    });
};

privateProperty(Torrent.prototype, 'remaining');
privateProperty(Torrent.prototype, 'processed');
privateProperty(Torrent.prototype, 'hasher');

// Class Exportation
exports.Torrent = Torrent;

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

// Returns a torrent meta data formatted file list
const createFileList = (root, files) => {
    root = isInterface(root, 'nsIFile') ? root : new nsIFile(root);
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

/*
 * Syntax:
 *
 *  All arguments except path are optional. Use of one does not require another.
 *  The "url" argument may be a url string or nsIURI instance.
 *
 *  createWebTorrent(url, callback, progress);
 *  createWebTorrent(url, pieceLength, callback, progress);
 *  createWebTorrent(url, callback, pieceLength, progress);
 *  createWebTorrent(url, callback, progress, pieceLength);
 *
 *  Warning: If progress(Function) argument is listed before the callback(Function)
 *  argument then their roles will be reversed.
 *  |
 *  v
 *  Do not do this: createWebTorrent(url, progress, callback);
 *
 *  @Param: pieceLength(Number)
 */

const createWebTorrent = (url, pieceLength, callback, listener) => {
    let uri = isInterface(url, 'nsIURI') ? url : newURI(url);
    // Allows for different argument arrangements
    if (typeof pieceLength === 'function')
        ([callback, pieceLength, listener]) = [pieceLength, callback, listener];
    if (typeof pieceLength === 'function')
        ([callback, listener, pieceLength]) = [callback, pieceLength, listener];
    let callable = (typeof callback === 'function');
    // Torrent creation
    remoteFileLength(url, length => {
        try {
            pieceLength = calcPieceLength(length, pieceLength);
        }
        catch (error) {
            if (callable)
                callback(null, error);
            return void(0);
        }
        let torrent = new Torrent({
            'url-list': [ url ],
            'info': {
                'length': length,
                'piece length': pieceLength,
                'name': uri.path.match(/\/([^\/?#]+)$/i)[1] || Date.now()
            }
        });
        torrent.updateFromURL(url, length, (torrent, error) => {
            torrent.finish();
            if (callable)
                callback(torrent, error);
        });
    });
};

exports.createWebTorrent = createWebTorrent;

/*
 * Syntax:
 *
 *  All arguments except path are optional. Use of one does not require another.
 *  The "file" argument may be a file path or nsIFile instance.
 *
 *  createTorrent(file, callback, progress);
 *  createTorrent(file, pieceLength, callback, progress);
 *  createTorrent(file, callback, pieceLength, progress);
 *  createTorrent(file, callback, progress, pieceLength);
 *
 *  Warning: If progress(Function) argument is listed before the callback(Function)
 *  argument then their roles will be reversed. 
 *  |
 *  v
 *  Do not do this: createTorrent(file, progress, callback);
 *
 *  @Param: pieceLength(Number)
 */

const createTorrent = (path, pieceLength, callback, listener) => {
    // Error Checking
    let file = isInterface(path, 'nsIFile') ? path : new nsIFile(path), files = [file];
    if (!file.exists())
        throw new Error('File does not exist.');
    // Allows for different argument arrangements
    if (typeof pieceLength === 'function')
        ([callback, pieceLength, listener]) = [pieceLength, callback, listener];
    if (typeof pieceLength === 'function')
        ([callback, listener, pieceLength]) = [callback, pieceLength, listener];
    // Torrent creation
    let torrent = new Torrent();
    if (file.isDirectory()) {
        if (!file.parent)
            throw new Error('Unable to create torrents from the root of drives.');
        files = fileList(file);
        torrent.info.files = createFileList(file, files);
    }
    torrent.info.name = file.leafName;
    let totalLength = 0;
    files.forEach(file => totalLength += file.fileSize);
    torrent.info.length = totalLength;
    if (!pieceLength)
        pieceLength = calcPieceLength(totalLength);
    torrent.info['piece length'] = pieceLength;
    let callable = (typeof callback === 'function');
    let fileIterator = (_, error) => {
        if (error) {
            if (callable)
                callback(torrent, error);
        }
        else if (files.length) {
            let file = files.shift();
            torrent.updateFromFile(file, fileIterator, listener);
        }
        else {
            torrent.finish()
            if (callable)
                callback(torrent);
        }
    };
    fileIterator();
};

exports.createTorrent = createTorrent;

/*
 * Syntax:
 *
 *  All arguments are optional. Use of one does not require another.
 *
 *  promptUser(title, callback, progress, notifyOnAbort);
 *  promptUser(title, modeGetFolder, callback, progress, notifyOnAbort);
 *  promptUser(title, callback, modeGetFolder, progress, notifyOnAbort);
 *  promptUser(title, callback, progress, modeGetFolder, notifyOnAbort);
 *
 *  Warning: If progress(Function) argument is listed before the callback(Function)
 *  argument then their roles will be reversed.
 *  |
 *  v
 *  Do not do this: promptUser(title, progress, callback);
 *
 *  @Param: modeGetFolder(Boolean)
 *  @Param: notifyOnAbort(Boolean)
 */

const promptUser = (title = '', modeGetFolder, callback, listener, notifyOnAbort) => {
    // Allows for different argument arrangements
    if (typeof modeGetFolder === 'function')
        ([callback, modeGetFolder, listener]) = [modeGetFolder, callback, listener];
    if (typeof modeGetFolder === 'function')
        ([callback, listener, modeGetFolder]) = [callback, modeGetFolder, listener];
    // File Picker
    let mode = modeGetFolder ? 'modeGetFolder' : 'modeOpen';
    let window = getWindow('navigator:browser');
    let picker = new nsIFilePicker();
    picker.init(window, title, picker[mode]);
    // Upon file chosen, create torrent
    picker.open(result => {
        if (result === picker.returnOK || result === picker.returnReplace) {
            try {
                createTorrent(picker.file, callback, listener);
            } catch (error) {
                if (typeof callback === 'function')
                    callback(null, error);
            }
        } else {
            if (notifyOnAbort && typeof callback === 'function')
                callback(null, new Error('User aborted.'));
        }
    });
};

exports.promptUser = promptUser;