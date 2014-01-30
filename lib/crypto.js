/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

module.metadata = {
  'stability': 'stable'
};

/*\
|*|
|*| This module wraps https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsICryptoHash
|*| This module only exports Class SHA1
|*|
\*/

/*
 * Examples:
 * let hexString = new SHA1('Some string that needs to be hashed.').hexDigest();
 * nsFile = Cc['@mozilla.org/file/local;1'].createInstance(Ci.nsILocalFile);
 * nsFile.initWithPath(path);
 * let hexString = new SHA1(nsFile).hexDigest();
 * let string = new SHA1('Some string that needs to be hashed.').digest();
 * let string = new SHA1(nsFile).digest();
 * let base64String = new SHA1(nsFile).digest(true);
 * let hasher = new SHA1();
 * hasher.updateFromStream(nsInputStream);
 * let string = hasher.digest();
 * ....
 */

const { CC, Ci } = require('chrome');

// Define Constructors
const nsICryptoHash = CC('@mozilla.org/security/hash;1', 'nsICryptoHash'); // https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsICryptoHash
const nsIFileInputStream = CC('@mozilla.org/network/file-input-stream;1', 'nsIFileInputStream', 'init'); // https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIFileInputStream
const nsIStringInputStream = CC('@mozilla.org/io/string-input-stream;1', 'nsIStringInputStream', 'setData'); // https://developer.mozilla.org/en-US/docs/XPCOM_Stream_Guide

// Import Modules
const { Class } = require('sdk/core/heritage'); // https://addons.mozilla.org/en-US/developers/docs/sdk/latest/modules/sdk/core/heritage.html
const { accessor } = require('./utils');

const PR_RDONLY = 0x01; // Open for reading only.
//
// Note: Octal literals require FF 25+
const PR_IRUSR = 0o0400; // read permission, owner
const PR_IRGRP = 0o0040; // read permission, group
const PR_IROTH = 0o0004; // read permission, others
//
// Define WeakMap Accessor
const crypto = accessor();

// Class Definition
const SHA1 = Class({
    initialize: function initialize(subject) {
        crypto(this, nsICryptoHash()).init(crypto(this).SHA1);
        if (subject) {
            let stream = this.createInputStream(subject);
            this.updateFromStream(stream, stream.available());
        }
    },
    createInputStream: function (subject) {
        if (subject) {
            if (subject instanceof Ci.nsIFile)
                return new nsIFileInputStream(subject, PR_RDONLY, PR_IRUSR+PR_IRGRP+PR_IROTH, 0);
            else if (typeof subject === 'string')
                return new nsIStringInputStream(subject, subject.length);
        }
        throw new TypeError('Supported types are String and nsIFile');
    },
    updateFromStream: function (stream, count) {
        crypto(this).updateFromStream(stream, count);
        return this;
    },
    update: function (data, count) {
        crypto(this).update(data, count);
        return this;
    },
    digest: function (base64) { // @Param: base64(Boolean) determines if whether or not the data will be returned as base64
        let result = crypto(this).finish(base64);
        this.initialize(); // create a new instance so we can use it again;
        return result;
    },
    hexDigest: function () {
        return this.digest(false).split('').
                map((char) => ('0' + String.charCodeAt(char).toString(16)).slice(-2)).join('');
    }
});


// Class Exportation
exports.SHA1 = SHA1;
