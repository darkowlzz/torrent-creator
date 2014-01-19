/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

const SYMBOLS = {
    /* open flags: -----------------------------------------
    |     Name     |      Value      |     Description     |
    ----------------------------------------------------- */
    // https://developer.mozilla.org/en-US/docs/PR_Open#Parameters
    PR_RDONLY:      parseInt('0x01'),   // Open for reading only.
    PR_WRONLY:      parseInt('0x02'),   // Open for writing only.
    PR_RDWR:        parseInt('0x04'), 	// Open for reading and writing.
    PR_CREATE_FILE: parseInt('0x08'),   // If the file does not exist, the file is created. If the file exists, this flag has no effect.
    PR_APPEND:      parseInt('0x10'),   // The file pointer is set to the end of the file prior to each write.
    PR_TRUNCATE:    parseInt('0x20'),   // If the file exists, its length is truncated to 0.
    PR_SYNC:        parseInt('0x40'),   // If set, each write will wait for both the file data and file status to be physically updated.
    PR_EXCL:        parseInt('0x80'),   // With PR_CREATE_FILE, if the file does not exist, the file is created. If the file already exists, no action and NULL is returned.

    /* permission flags: -----------------------------------
    |     Name     |      Value      |     Description     |
    ----------------------------------------------------- */
    // https://developer.mozilla.org/en-US/docs/PR_Open#Parameters
    // When PR_CREATE_FILE flag is set and the file is created, these flags define the access permission bits of the newly created file. 
    // This feature is currently only applicable on Unix platforms. It is ignored by any other platform but it may apply to other platforms in the future.
    // Possible values of the mode parameter are listed in the table below.
    PR_IRWXU:       parseInt('0700', 8), // read, write, execute/search by owner.
    PR_IRUSR:       parseInt('0400', 8), // read permission, owner.
    PR_IWUSR:       parseInt('0200', 8), // write permission, owner.
    PR_IXUSR:       parseInt('0100', 8), // execute/search permission, owner.
    PR_IRWXG:       parseInt('0070', 8), // read, write, execute/search by group
    PR_IRGRP:       parseInt('0040', 8), // read permission, group
    PR_IWGRP:       parseInt('0020', 8), // write permission, group
    PR_IXGRP:       parseInt('0010', 8), // execute/search permission, group
    PR_IRWXO:       parseInt('0007', 8), // read, write, execute/search by others
    PR_IROTH:       parseInt('0004', 8), // read permission, others
    PR_IWOTH:       parseInt('0002', 8), // write permission, others
    PR_IXOTH:       parseInt('0001', 8), // execute/search permission, others
    
    /* behavior flags: -------------------------------------
    |     Name     |      Value      |     Description     |
    ----------------------------------------------------- */
    // https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsIFileInputStream#Constants
    DELETE_ON_CLOSE:    1<<1,           // If this is set, the file will be deleted by the time the stream is closed.
    CLOSE_ON_EOF:       1<<2,           // If this is set, the file will close automatically when the end of the file is reached.
    REOPEN_ON_REWIND:   1<<3,           // If this is set, the file will be reopened whenever Seek(0) occurs.
    DEFER_OPEN:         1<<4            // If this is set, the file will be opened (i.e., a call to PR_Open() done) only when we do an actual operation on the stream
};

if (~String(this).indexOf('BackstagePass'))
    (this.EXPORTED_SYMBOLS = Object.keys(SYMBOLS)).forEach(name => this[name] = SYMBOLS[name]);
else if (typeof exports !== 'undefined')
    Object.keys(SYMBOLS).forEach(name => exports[name] = SYMBOLS[name]);
