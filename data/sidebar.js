/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

window.addEventListener('load', event => {
    // Select source on click.
    const source = document.querySelector('#source > input');
    source.addEventListener('focus', event => source.select());
    // Globals
    var savePath = '', fileName = '';
    // Drag and drop source
    listen(window, 'dragenter', event => event.preventDefault());
    listen(window, 'dragover', event => event.preventDefault());
    // On drop set the source input value and set the mode
    listen(window, 'drop', event => {
        var value = event.dataTransfer.getData('text/x-moz-url');
        getType(source.value = value.split('\n')[0]);
    });

    // Single or multiple file torrent mode selection
    const multiMode = document.querySelector('#multi');
    const singleMode = document.querySelector('#single');
    // Initial mode
    singleMode.checked = true;
    // Toggle mode
    listen(multiMode, 'click', event => singleMode.checked = false);
    listen(singleMode, 'click', event => multiMode.checked = false);

    // Port on fileURL result of nsIFilePicker
    receive('source', fileURL => source.value = fileURL);
    receive('path', (path, leafName) => {
        savePath = path;
        fileName = leafName;
        console.debug(savePath, fileName);
    });

    // Port on result of get-type
    receive('type', isDirectory => {
        singleMode.checked = !isDirectory;
        multiMode.checked = isDirectory;
    });

    // On click invoke nsIFilePicker
    listen('#source > img', 'click', event => selectSource(multiMode.checked));

    // Text areas
    const trackers = document.querySelector('#trackers > textarea');
    listen(trackers, 'blur', event => trackers.scrollLeft = trackers.scrollTop = 0);
    const webSeeds = document.querySelector('#web-seeds > textarea');
    listen(webSeeds, 'blur', event => webSeeds.scrollLeft = webSeeds.scrollTop = 0);

    // Setup event listeners
    const comment = getOption('comment');
    const name = getOption('name');
    const createdBy = getOption('created-by');
    const creationDate = getOption('creation-date');
    const pieceLength = getOption('piece-length');

    // Checkboxes
    const privateOpt = document.querySelector('#private');
    const saveDefaults = document.querySelector('#save-defaults');
    listen(saveDefaults, 'click', event => {
        if (saveDefaults.checked)
            notify('Note', 'Your settings will be saved after successful torrent creation.')
    });
    
    // Prevent links and images from being dragged and links from click navigation(redirection)
    listen('img, a', 'mousedown', blockEvent);
    listen('a', 'click', blockEvent);

    getPrototype();
    receive('prototype', prototype => {

        // Apply defaults
        comment.value = prototype['comment'] || '';
        name.value = prototype['name'] || '';
        pieceLength.value = prototype['piece length'] || '';
        privateOpt.checked = !!prototype['info']['private'];
        createdBy.value = prototype['created by'] || '';
        creationDate.value = getDate(prototype['creation date'] * 1000);

        // On click emit the create event to main with the source and prototype arguments
        listen('#button-create', 'click', event => {
            if (source.validity.valid) {
                var urlList;
                if (trackers.value) {
                    urlList = [];
                    trackers.value.split(/\s/).filter(value => !!value).
                            forEach(url => urlList.push([url]));
                    if (urlList.length) {
                        prototype['announce-list'] = urlList;
                        prototype['announce'] = urlList[0][0];
                    }
                }
                if (webSeeds.value) {
                    urlList = webSeeds.value.split(/\s/).filter(value => !!value);
                    if (urlList.length)
                        prototype['url-list'] = urlList;
                }
                if (comment.value)
                    prototype['comment'] = comment.value;
                if (creationDate.value) {
                    var date = Date.parse(creationDate.value) / 1000;
                    if (!isNaN(date))
                        prototype['creation date'] = date;
                }
                if (createdBy.value)
                    prototype['created by'] = createdBy.value;
                if (pieceLength.value) {
                    var num = pieceLength.value.match(/\d*/)[0];
                    if (num) {
                        if (/mb/i.test(pieceLength.value))
                            prototype['info']['piece length'] = num * 1024*1024;
                        else if (/kb/i.test(pieceLength.value))
                            prototype['info']['piece length'] = num * 1024;
                        else prototype['info']['piece length'] = num;
                    }
                }
                if (name.value)
                    prototype['info']['name'] = name.value;
                if (privateOpt.checked)
                    prototype['info']['private'] = 1;
                create(source.value, prototype, savePath, fileName || 'Not implemented...');
                if (saveDefaults.checked)
                    setPrototype(prototype);
            } else {
                notify('Error', 'You must enter a valid source URL');
                source.focus();
            }
        });

        listen('#button-save-as', 'click', event =>
                saveAs(name.value || source.value));

    });
});

