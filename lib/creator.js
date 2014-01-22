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
    nsIBinaryOutputStream,
    nsILocalFile,
    nsIThreadManager,
    nsIStreamTransportService,
    nsIWindowMediator,
    nsIFilePicker,
    nsIConverterOutputStream
} = CHROME;

// Define QI Global
const { QI } = CHROME;

// Used to access nsIProperties
const FileUtils = CHROME.FileUtils();

// Used for file stream manipulation
const NetUtil = CHROME.NetUtil();

// Define Helpers
const { isInterface, isSuccessCode } = CHROME;
const hasOwnProperty = Object.prototype.hasOwnProperty;
const hasOwn = (object, property) => hasOwnProperty.call(object, property);

// Define Errors
const { NS_ERROR_NOT_AVAILABLE, NS_ERROR_UNEXPECTED, NS_BASE_STREAM_CLOSED } = CHROME.Cr;

// Import modules
const { Class, mix, obscure } = require('sdk/core/heritage');
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

// Define Shortcuts
const currentThread = () => threadMgr.currentThread;
const createInputTransport = (...args) => transportSrv.createInputTransport(...args);
const getWindow = type => windowMediator.getMostRecentWindow(type || '');
const getFile = (file, pathArray) => FileUtils.getFile(file, pathArray || []);
const openSafeFileOutputStream = (...args) => FileUtils.openSafeFileOutputStream(...args);

// Create nsIFile Constructor
function nsIFile(path) {
    let file = new nsILocalFile();
    file.initWithPath(path);
    return file;
}


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

// Define WeakMap Accessor
const hasher = accessor();
const secret = accessor();

// Utility function to copy object(s)'s properties to another object
// without modify those objects.
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

// Class Definition
function Torrent(prototype = {}) {
    hasher(this, new SHA1());
    secret(this, {});
    merge(this, getTemplate(), prototype);
}

Torrent.prototype = obscure({ // Ensure that the following methods can't be enumerated.
    updateFromFile: function (file, callback, listener) {
        let callable = (typeof callback === 'function');
        let stream = new nsIFileInputStream(file, readFlags, permFlags, behavFlags);
        let asyncStream = new nsIAsyncInputStream(stream, listener);
        let remaining = secret(this).remaining || this.info['piece length'];
        let processed = 0, available, count, errors = 0;
        let onInputStreamReady = () => {
            let errorOcurred = false;
            try {
                available = asyncStream.available();
                count = (remaining > available) ? available : remaining;
                hasher(this).updateFromStream(asyncStream, count)
                processed += count;
                remaining -= count;
                if (!remaining) {
                    remaining = this.info['piece length'];
                    this.info.pieces += hasher(this).digest();
                }
                if (processed === file.fileSize) {
                    secret(this).remaining = remaining;
                     if (callable)
                         callback(this);
                     return void(0);
                }
            }
            catch (error if error.result === NS_ERROR_NOT_AVAILABLE) {
                errorOcurred = true;
                if (++errors > 10) {
                    if (callable)
                        callable(this, new Error('The data stream is not available.'));
                    return void(0);
                }
            }
            catch (error if error.result === NS_BASE_STREAM_CLOSED) {
                if (callable)
                    callback(this, new Error('The amount of data hashed doesn\'t match the expected total.'));
                return void(0);
            }
            if (!errorOcurred && errors)
                errors--;
            asyncStream.asyncWait(onInputStreamReady, 0, this.info['piece length'], currentThread());
        }
        asyncStream.asyncWait(onInputStreamReady, 0, this.info['piece length'], currentThread());
    },
    finish: function () {
        let needPieces = Math.ceil(this.info.length/this.info['piece length']);
        let havePieces = (this.info.pieces.length/20);
        if (needPieces !== havePieces)
            this.info.pieces += hasher(this).digest();
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
 *  The "file" argument may be a file path or nsIFile instance.
 *
 *  createTorrent(file, callback, progress);
 *  createTorrent(file, pieceSize, callback, progress);
 *  createTorrent(file, callback, pieceSize, progress);
 *  createTorrent(file, callback, progress, pieceSize);
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