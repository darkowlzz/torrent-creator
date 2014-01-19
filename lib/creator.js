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
    nsIBinaryOutputStream,
    nsIFileInputStream,
    nsILocalFile,
    nsIThreadManager,
    nsIStreamTransportService
} = CHROME;

// Define QI Global
const { QI } = CHROME;

// Define Errors
const { NS_ERROR_NOT_AVAILABLE, NS_ERROR_UNEXPECTED, NS_BASE_STREAM_CLOSED } = CHROME.Cr;

// Import modules
const { Class, mix, obscure } = require('sdk/core/heritage');
const { SHA1 } = require('./crypto');
const { bencode } = require('./bencode');
const { accessor } = require('./utils');
const constants = require('./constants');

// Define Flags
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

// Define Shortcuts
const currentThread = () => threadMgr.currentThread;
const createInputTransport = (...args) => transportSrv.createInputTransport(...args);

// Create nsIFile Constructor
function nsIFile(path) {
    let file = new nsILocalFile();
    file.initWithPath(path);
    return file;
}

// Create nsIAsyncInputStream Constructor - https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIAsyncInputStream
function nsIAsyncInputStream(aStream) {
    //createInputTransport(aStream, aStartOffset, aReadLimit, aCloseWhenDone), // openInputStream(aFlags, aSegmentSize, aSegmentCount)
    return QI.nsIAsyncInputStream(createInputTransport(aStream, 0, -1, true).openInputStream(0, 0, 0));
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
    let files = enumToArray(files.directoryEntries).map(QI.nsIFile);
    let list = [];
    files.forEach(file => {
        if (file.isDirectory())
            list.push(...fileList(file));
        else if (file.fileSize > 0)
            list.push(file);
    });
    return list;
};

// Define WeakMap Accessors
const hasher = accessor();
const privateProperties = accessor();

// Class Definition
function Torrent(prototype) {
    hasher(this, new SHA1());
    privateProperties(this, {});
    if (typeof prototype === 'object')
        merge(this, prototype);
};
Torrent.prototype = mix({ // Defaults
    'encoding': 'UTF-8',
    'info': {
        'length': 0,
        'name': '',
        'piece length': 0,
        'pieces': ''
    }
}, obscure({ // Ensure that the following methods can't be enumerated.
    createFromFile: function (path, pieceLength, async) {
        let file = new nsIFile(path);
        if (!file.exists())
            throw new Error('File does not exist.')
        if (file.isDirectory())
            throw new Error('File is a directory.');
        this.info.name = file.leafName;
        this.info.length = file.fileSize;
        this.info['piece length'] = Torrent.getPieceLength(file.fileSize, pieceLength);
        let need = Math.ceil(this.info.length/this.info['piece length']);
        console.log('need ' + need + ' pieces');
        let stream = new nsIFileInputStream(file, readFlags, permFlags, behavFlags);
        if (async) {
            let asyncStream = new nsIAsyncInputStream(stream);
            let onInputStreamReady = () => {
                try {
                    if (this.updateFromStream(stream) === this.info.length)
                        console.log('finished');
                    else console.log(this.processed + ' of ' + this.info.length);
                }
                catch (error if error.result === NS_ERROR_NOT_AVAILABLE) { console.log(this.currentPiece === need, need, this.currentPiece)}
                if (stream.available)
                    asyncStream.asyncWait(onInputStreamReady, 0, this.info['piece length'], currentThread());
            }
            asyncStream.asyncWait(onInputStreamReady, 0, this.info['piece length'], currentThread());
        }
        else {
            try {
                while (stream.available)
                    this.updateFromStream(stream);
            }
            catch (error if error.result === NS_BASE_STREAM_CLOSED) {}
            return true;
        }
    },
    setFiles: function () {
        let root = new nsIFile(this.info.files[0]);
        if (!this.info.name)
            this.info.name = root.leafName;
        if (root.isDirectory()) {
            if (root.parent === null)
                throw Error('Unable to create torrents from the root of drives');
            this.info.files = fileList(root);
        }
        else this.info.files = [root];
    },
    updateFromStream: function (stream) {
        let count = this.getCount(stream.available());
        hasher(this).updateFromStream(stream, count);
        let remaining = this.remaining(count);
        this.processed += count;
        if (!remaining)
            this.updatePieces();
        return count; // The amount of data read from the stream.
    },
    updatePieces: function () {
        this.info.pieces += hasher(this).digest();
        this.currentPiece++;
    },
    isFinished: false,
    remaining: function (count) {
        if (count)
            return this._remaining -= count;
        else if (!this._remaining)
            return this._remaining = this.info['piece length'];
        return this._remaining;
    },
    currentPiece: 1,
    processed: 0,
    getCount: function (available) {
        let count = this.remaining();
        if (count >= available)
            return available;
        return count;
    },
    toString: function () {
        return bencode(this);
    }
}));

Torrent.getPieceLength = (totalLength, pieceLength = 0) => {
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

// Class Exportation
exports.Torrent = Torrent;


/*
if (remaining) info.pieces += hasher.digest(); dead = true;
if (root.isDirectory()) {
    var files = [], path;
    for (file of info.files) {
        path = [file.leafName]; length = file.fileSize;
        while (file.parent !== null) {
            file = file.parent;
            if (file.path === root.path) break;
            path.push(file.leafName);
        }
        path.reverse();
        files.push({'length':length, 'path':path});
    }
    info.files = files;
} else delete info.files;
torrent = bencode(torrent);
file = getFile(outfile);
var fileStream = nsIFileOutputStream();
fileStream.init(file, writeFlags, permFlags, 0);
var byteStream = nsIBinaryOutputStream();
byteStream.setOutputStream(fileStream);
byteStream.writeBytes(torrent, torrent.length);
byteStream.close(); return;

exports.createTorrent = function (torrent, progress, outfile) {
    torrent = torrent || {}; // Pass your own torrent object for creation or use the defaults.
    torrent = mix(Torrent.prototype, torrent); // Fill in the blanks.
    torrent.setFiles();
    torrent.setLength();
    torrent.setPieceLength();
    var active = true, dead = false, next = true, ready = false;
    var control = {
        suspend: function() { next = false; },
        resume: function () {
            if (!active) {
                next = true;
                if (ready && !dead) control.stream.asyncWait();
            }
        },
        abort: function () { if (!dead) control.resume(); dead = true; }
    };
    var callback = false, length = 0, read = 0, index = 0, requested, available, hasher = new SHA1(), name
        remaining = info['piece length'];
        file = info.files[index];
    if (typeof progress === 'function')
        callback = true;

    control.stream = new AsyncFileStream(file, onDataAvailable, info['piece length']); ready = true;
    return control;

};

    var onDataAvailable = function (inputStream) {
        try {
            available = inputStream.available();
            if (remaining >= available) requested = available;
            else requested = remaining;
            try {
                hasher.updateFromStream(inputStream.asyncStream, requested);
                remaining -= requested; length += requested; read += requested;
                if (callback) progress(read, info.length, {'name':file.leafName,'read':length,'size':file.fileSize});
                if (!remaining) {
                    info.pieces += hasher.digest(); remaining = info['piece length'];
                }
                if (length === file.fileSize) {
                    length = 0;
                    if (index < info.files.length-1) {
                        file = info.files[++index];
                        control.stream = new AsyncFileStream(file, onDataAvailable, info['piece length']); return;
                    } else {

                    }
                }
            } catch (error if error === NS_ERROR_NOT_AVAILABLE) {}
            active = next;
            if (!dead) {
                if (active) inputStream.asyncWait();
                else if (callback) progress(read, info.length, {'name':'Process suspended.','read':length,'size':file.fileSize});
            } else {
                inputStream.close(); control = undefined;
            }
        } catch (error) {
            console.log(error);
        }
    };
    */