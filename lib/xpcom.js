/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

module.metadata = {
  'stability': 'unstable'
};

/*\
|*|
|*| XPCOM is only accessed through this module.
|*|
\*/

// https://addons.mozilla.org/en-US/developers/docs/sdk/latest/dev-guide/tutorials/chrome.html
const { Ci, Cr, Cc, CC, Cu, Cm, components } = require('chrome'); // XPCOM


// Create Constructors
const CONSTRUCTORS = {
    nsIThreadManager: CC('@mozilla.org/thread-manager;1', 'nsIThreadManager'),
    nsIStreamTransportService: CC('@mozilla.org/network/stream-transport-service;1', 'nsIStreamTransportService'),
    nsIScriptableInputStream: CC('@mozilla.org/scriptableinputstream;1', 'nsIScriptableInputStream', 'init'),
    nsIBinaryOutputStream: CC('@mozilla.org/binaryoutputstream;1', 'nsIBinaryOutputStream', 'setOutputStream'),
    nsIFileOutputStream: CC('@mozilla.org/network/file-output-stream;1', 'nsIFileOutputStream', 'init'),
    nsIFileInputStream: CC('@mozilla.org/network/file-input-stream;1', 'nsIFileInputStream', 'init'), // https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIFileInputStream
    nsIStringInputStream: CC('@mozilla.org/io/string-input-stream;1', 'nsIStringInputStream', 'setData'), // https://developer.mozilla.org/en-US/docs/XPCOM_Stream_Guide
    nsICryptoHash: CC('@mozilla.org/security/hash;1', 'nsICryptoHash'), // https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsICryptoHash
   // nsIWindowMediator: CC('@mozilla.org/appshell/window-mediator;1'), // https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIWindowMediator
    nsIFilePicker: CC('@mozilla.org/filepicker;1', 'nsIFilePicker'), // https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIFilePicker
    nsILocalFile: CC('@mozilla.org/file/local;1', 'nsILocalFile'),
    nsIScriptableUnicodeConverter: CC('@mozilla.org/intl/scriptableunicodeconverter', 'nsIScriptableUnicodeConverter'),
    nsIConverterOutputStream: CC('@mozilla.org/intl/converter-output-stream;1', 'nsIConverterOutputStream', 'init')
};

// Export Constructors
Object.keys(CONSTRUCTORS).forEach(ctor => exports[ctor] = CONSTRUCTORS[ctor]);

// Export Components Results
exports.Cr = Cr;

// Query Interface Shortcuts
const QI = {
    nsIAsyncInputStream: (stream) => stream.QueryInterface(Ci.nsIAsyncInputStream),
    nsIFile: (file) => file.QueryInterface(Ci.nsIFile)
};

exports.QI = QI;

// Export Helpers
exports.isInterface = (object, name) => object instanceof Ci[name];
exports.isSuccessCode = (status) => components.isSuccessCode(status);

// Other Exports
exports.FileUtils = FileUtils;
exports.nsIWindowMediator = nsIWindowMediator;
exports.NetUtil = NetUtil;


// More Constructors
function FileUtils() {
    return Cu.import('resource://gre/modules/FileUtils.jsm', {}).FileUtils;
}

function NetUtil() {
    return Cu.import('resource://gre/modules/NetUtil.jsm', {}).NetUtil;
}

function nsIWindowMediator() {
    return Cc['@mozilla.org/appshell/window-mediator;1'].getService(Ci.nsIWindowMediator);
}

const nsICategoryManager = CC('@mozilla.org/categorymanager;1', 'nsICategoryManager');
exports.nsICategoryManager = nsICategoryManager;

const nsIUUIDGenerator = CC('@mozilla.org/uuid-generator;1', 'nsIUUIDGenerator');
exports.nsIUUIDGenerator = nsIUUIDGenerator;


const { registerFactory } = Cm.QueryInterface(Ci.nsIComponentRegistrar);
exports.registerFactory = registerFactory;


