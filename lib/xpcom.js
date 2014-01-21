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
    nsIScriptableUnicodeConverter: CC('@mozilla.org/intl/scriptableunicodeconverter', 'nsIScriptableUnicodeConverter')
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

// XPCOM Extendable Constructors

const { Class } = require('sdk/core/heritage');
const { merge } = require('sdk/util/object');

const nsIModule = Class({
    getClassObject : function (aCompMgr, aCID, aIID) {
        if (aCID.equals(this.id))
            return this.QueryInterface(aIID);

        throw Cr.NS_ERROR_FAILURE;
    },
    registerSelf : function (aCompMgr, aFileSpec, aLocation, aType) {
        let compReg = aCompMgr.QueryInterface(Ci.nsIComponentRegistrar);

        compReg.registerFactoryLocation(this.id, this.class, this.contract,
                            aFileSpec, aLocation, aType);

        let catMan = new nsICategoryManager();
        catMan.addCategoryEntry('command-line-handler',
                    this.category, this.id, true, true);
    },
    unregisterSelf : function (aCompMgr, aLocation, aType) {
        let compReg = aCompMgr.QueryInterface(Ci.nsIComponentRegistrar);
        compReg.nregisterFactoryLocation(this.id, aLocation);

        let catMan = new nsICategoryManager();
        catMan.deleteCategoryEntry('command-line-handler', this.category);
    },
    canUnload : function (aCompMgr) {
        return true;
    }
});

exports.nsIModule = nsIModule;

function hasInterface(component, iid) {
    return component && component.interfaces &&
      ( component.interfaces.some(function(id) iid.equals(Ci[id])) ||
        component.implements.some(function($) hasInterface($, iid)) ||
        hasInterface(Object.getPrototypeOf(component), iid));
}

const nsISupports = Class({
    QueryInterface: function QueryInterface(iid) {
        if (iid && !hasInterface(this, iid))
            throw Cr.NS_ERROR_NO_INTERFACE;
        return this;
    },
    interfaces: Object.freeze([ 'nsIModule, nsISupports' ])
});

exports.nsISupports = nsISupports;

const nsIInterfaceRequestor = Class({
    extends: nsISupports,
    get wrappedJSObject() this,
    initialize: function initialize() {},
    interfaces: ['nsIInterfaceRequestor'],
    getInterface: function (aIID) {
        try {
            return this.QueryInterface(aIID);
        } catch (error) {
            throw Cr.NS_NOINTERFACE;
        }
    }
});

exports.nsIInterfaceRequestor = nsIInterfaceRequestor;

const nsISupportsWeakReference = Class({
    extends: nsIInterfaceRequestor,
    initialize: function initialize() {
        nsIInterfaceRequestor.prototype.initialize.call(this);
    },
    GetWeakReference: function () {
        return { QueryReferent: this.QueryInterface };
    }
});

exports.nsISupportsWeakReference = nsISupportsWeakReference;

const { registerFactory } = Cm.QueryInterface(Ci.nsIComponentRegistrar);
exports.registerFactory = registerFactory;

const nsIFactory = Class({
    extends: nsISupports,
    interfaces: [ 'nsIFactory' ],
    initialize: function initialize(options = {}) {
        merge(this, options);
        if (!this.id) {
            let { generateUUID } = new nsIUUIDGenerator();
            this.id = generateUUID();
        }
    },
    description: '',
    lockFactory: function lockFactory(lock) undefined,
    register: true,
    unregister: true,
    class: '',
    contract: '',
    category: '',
    id: null,
    Component: null,
    createInstance: function createInstance(outer, iid) {
        try {
            if (outer)
                throw Cr.NS_ERROR_NO_AGGREGATION;
            return this.create().QueryInterface(iid);
        }
        catch (error) {
            throw error instanceof Ci.nsIException ? error : Cr.NS_ERROR_FAILURE;
        }
    },
    create: function create() this.Component(),
    selfRegister: function () {
        registerFactory(this.id, this.description, this.contract, this);
    }
});

exports.nsIFactory = nsIFactory;

// https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsICommandLineHandler
const nsICommandLineHandler = Class({
    extends: nsIFactory,
    interfaces: [ 'nsICommandLineHandler' ],
    implements: [ nsIModule ],
    initialize: function initialize(options) {
        nsIFactory.prototype.initialize.call(this, options);
        this.Component = this;
    },
    handle : function (cmdLine) {}, // https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsICommandLine
    // CHANGEME: change the help info as appropriate, but
    // follow the guidelines in nsICommandLineHandler.idl
    // specifically, flag descriptions should start at
    // character 24, and lines should be wrapped at
    // 72 characters with embedded newlines,
    // and finally, the string should end with a newline
    helpInfo : ''
});

exports.nsICommandLineHandler = nsICommandLineHandler;


