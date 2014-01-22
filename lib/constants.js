/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

/*\
|*|
|*| Constants needed for mozilla's XPCOM interfaces.
|*|
\*/

const SYMBOLS = {
    /* open flags: -----------------------------------------
    |     Name     |      Value      |     Description     |
    ----------------------------------------------------- */
    // https://developer.mozilla.org/en-US/docs/PR_Open#Parameters
    PR_RDONLY:      0x01, // Open for reading only.
    PR_WRONLY:      0x02, // Open for writing only.
    PR_RDWR:        0x04, // Open for reading and writing.
    PR_CREATE_FILE: 0x08, // If the file does not exist, the file is created. If the file exists, this flag has no effect.
    PR_APPEND:      0x10, // The file pointer is set to the end of the file prior to each write.
    PR_TRUNCATE:    0x20, // If the file exists, its length is truncated to 0.
    PR_SYNC:        0x40, // If set, each write will wait for both the file data and file status to be physically updated.
    PR_EXCL:        0x80, // With PR_CREATE_FILE, if the file does not exist, the file is created. If the file already exists, no action and NULL is returned.

    /* permission flags: -----------------------------------
    |     Name     |      Value      |     Description     |
    ----------------------------------------------------- */
    // https://developer.mozilla.org/en-US/docs/PR_Open#Parameters
    // When PR_CREATE_FILE flag is set and the file is created, these flags define the access permission bits of the newly created file. 
    // This feature is currently only applicable on Unix platforms. It is ignored by any other platform but it may apply to other platforms in the future.
    // Possible values of the mode parameter are listed in the table below.
    // Note: Octal literals require FF 25+
    PR_IRWXU:       0o0700, // read, write, execute/search by owner.
    PR_IRUSR:       0o0400, // read permission, owner.
    PR_IWUSR:       0o0200, // write permission, owner.
    PR_IXUSR:       0o0100, // execute/search permission, owner.
    PR_IRWXG:       0o0070, // read, write, execute/search by group
    PR_IRGRP:       0o0040, // read permission, group
    PR_IWGRP:       0o0020, // write permission, group
    PR_IXGRP:       0o0010, // execute/search permission, group
    PR_IRWXO:       0o0007, // read, write, execute/search by others
    PR_IROTH:       0o0004, // read permission, others
    PR_IWOTH:       0o0002, // write permission, others
    PR_IXOTH:       0o0001, // execute/search permission, others
    
    /* behavior flags: -------------------------------------
    |     Name     |      Value      |     Description     |
    ----------------------------------------------------- */
    // https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIFileInputStream#Constants
    DELETE_ON_CLOSE:    1<<1, // If this is set, the file will be deleted by the time the stream is closed.
    CLOSE_ON_EOF:       1<<2, // If this is set, the file will close automatically when the end of the file is reached.
    REOPEN_ON_REWIND:   1<<3, // If this is set, the file will be reopened whenever Seek(0) occurs.
    DEFER_OPEN:         1<<4, // If this is set, the file will be opened (i.e., a call to PR_Open() done) only when we do an actual operation on the stream

    /* open flags: -----------------------------------------
    |     Name     |      Value      |     Description     |
    ----------------------------------------------------- */
    // http://dxr.mozilla.org/mozilla-central/source/netwerk/base/public/nsITransport.idl?from=nsITransport.idl#33
    OPEN_BLOCKING:      1<<0, // If specified, then the resulting stream will have blocking stream semantics.
    OPEN_UNBUFFERED:    1<<1  // If specified, the resulting stream may not support ReadSegments.
};


if (~String(this).indexOf('BackstagePass'))
    (this.EXPORTED_SYMBOLS = Object.keys(SYMBOLS)).forEach(name => this[name] = SYMBOLS[name]);
else if (typeof exports !== 'undefined')
    Object.keys(SYMBOLS).forEach(name => exports[name] = SYMBOLS[name]);
