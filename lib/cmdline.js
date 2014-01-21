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
|*| Command Line Handler
|*|
\*/

const { nsICommandLineHandler } = require('./xpcom');

const handler = new nsICommandLineHandler({
    contract: '@mozilla.org/commandlinehandler/general-startup;1?type=torrent-creator',
    class: 'torrent-creator-clh',
    category: 'm-torrent-creator',
    description: 'Torrent Creator - CLH',
    handle: function (cmdLine) {
        try {
            console.log('TEST!');
            // CHANGEME: change 'viewapp' to your command line flag that takes an argument
            let uristr = cmdLine.handleFlagWithParam('viewapp', false);
            if (uristr) {
                console.log('TEST!');
                // convert uristr to an nsIURI
                let uri = cmdLine.resolveURI(uristr);
                //openWindow(CHROME_URI, uri);
                cmdLine.preventDefault = true;
            }
        }
        catch (error) {
            console.log('TEST!');
            //Components.utils.reportError('incorrect parameter passed to -viewapp on the command line.');
            console.log('incorrect parameter passed to -viewapp on the command line.');
        }
        // CHANGEME: change 'myapp' to your command line flag (no argument)
        if (cmdLine.handleFlag('myapp', false)) {
            console.log('TEST!');
            //openWindow(CHROME_URI, null);
            cmdLine.preventDefault = true;
        }
    },
    helpInfo: '  -myapp               Open My Application\n' +
            '  -viewapp <uri>       View and edit the URI in My Application,\n' +
            '                       wrapping this description\n'
});

handler.selfRegister();