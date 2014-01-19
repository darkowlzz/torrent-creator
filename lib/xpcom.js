/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

module.metadata = {
  'stability': 'unstable'
};

/*
 * XPCOM is only accessed through this module.
 */

// https://addons.mozilla.org/en-US/developers/docs/sdk/latest/dev-guide/tutorials/chrome.html
const { Ci, Cr, CC } = require('chrome'); // XPCOM


// Create Constructors
const CONSTRUCTORS = {
    nsIThreadManager: CC('@mozilla.org/thread-manager;1', 'nsIThreadManager'),
    nsIStreamTransportService: CC('@mozilla.org/network/stream-transport-service;1', 'nsIStreamTransportService'),
    nsIScriptableInputStream: CC('@mozilla.org/scriptableinputstream;1', 'nsIScriptableInputStream', 'init'),
    nsIBinaryOutputStream: CC('@mozilla.org/binaryoutputstream;1', 'nsIBinaryOutputStream', 'init'),
    nsIFileOutputStream: CC('@mozilla.org/network/file-output-stream;1', 'nsIFileOutputStream', 'init'),
    nsIFileInputStream: CC('@mozilla.org/network/file-input-stream;1', 'nsIFileInputStream', 'init'), // https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIFileInputStream
    nsIStringInputStream: CC('@mozilla.org/io/string-input-stream;1', 'nsIStringInputStream', 'setData'), // https://developer.mozilla.org/en-US/docs/XPCOM_Stream_Guide
    nsICryptoHash: CC('@mozilla.org/security/hash;1', 'nsICryptoHash'), // https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsICryptoHash
    nsILocalFile: CC('@mozilla.org/file/local;1', 'nsILocalFile')
};

// Export Constructors
Object.keys(CONSTRUCTORS).forEach(ctor => exports[ctor] = CONSTRUCTORS[ctor]);

// Export Errors
exports.Cr = Cr;

// Query Interface Shortcuts
const QI = {
    nsIAsyncInputStream: (stream) => stream.QueryInterface(Ci.nsIAsyncInputStream),
    nsIFile: (file) => file.QueryInterface(Ci.nsIFile)
};

exports.QI = QI;

// Export Helpers
exports.isInterface = (object, name) => object instanceof Ci[name];