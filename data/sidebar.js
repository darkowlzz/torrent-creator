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
    // Set initial button state / Change on valid source
    const createButton = document.querySelector('#button-create');
    createButton.setAttribute('class', 'button-disabled');
    const saveAsButton = document.querySelector('#button-save-as');
    saveAsButton.setAttribute('class', 'button-disabled');
    // Enable buttons if source is valid.
    const toggleButtons = event => {
        if (source.validity.valid) {
            createButton.setAttribute('class', 'button-enabled');
            saveAsButton.setAttribute('class', 'button-enabled');
        }
        else {
            createButton.setAttribute('class', 'button-disabled');
            saveAsButton.setAttribute('class', 'button-disabled');
        }
    };
    listen(source, 'input', toggleButtons);
    listen(source, 'change', toggleButtons);
    // Drag and drop source
    listen(window, 'dragenter', event => event.preventDefault());
    listen(window, 'dragover', event => event.preventDefault());
    // On drop set the source input value and set the mode
    listen(window, 'drop', event => {
        var value = event.dataTransfer.getData('text/x-moz-url');
        getType(source.value = value.split('\n')[0]);
        toggleButtons();
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
    receive('source', fileURL => { 
        source.value = fileURL
        toggleButtons();
    });
    receive('path', (path, leafName) => {
        savePath = path;
        fileName = leafName;
    });

    // Port on result of get-type
    receive('type', isDirectory => {
        singleMode.checked = !isDirectory;
        multiMode.checked = isDirectory;
    });

    // On click invoke nsIFilePicker
    listen('#source > img', 'click', event => selectSource(multiMode.checked));

    // Text areas

    const resetPos = event => {
        event.target.setSelectionRange(0, 0);
        event.target.scrollLeft = event.target.scrollTop = 0;
    };
    const trackers = document.querySelector('#trackers > textarea');
    const webSeeds = document.querySelector('#web-seeds > textarea');
    listen(webSeeds, 'blur', resetPos);
    listen(trackers, 'blur', resetPos);

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
    
    // Prevent links and images from being dragged
    listen('img, a', 'mousedown', blockEvent, true);

    getPrototype();
    receive('prototype', prototype => {

        // Apply defaults
        comment.value = prototype['comment'] || '';
        name.value = prototype['info']['name'] || '';
        pieceLength.value = prototype['info']['piece length'] || '';
        privateOpt.checked = !!prototype['info']['private'];
        createdBy.value = prototype['created by'] || '';
        creationDate.value = getDate(prototype['creation date'] * 1000);

        // On click emit the create event to main with the source and prototype arguments
        listen(createButton, 'click', event => {
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
                else {
                    delete prototype['announce-list'];
                    delete prototype['announce'];
                }
                if (webSeeds.value) {
                    urlList = webSeeds.value.split(/\s/).filter(value => !!value);
                    if (urlList.length)
                        prototype['url-list'] = urlList;
                }
                else delete prototype['url-list'];
                if (comment.value)
                    prototype['comment'] = comment.value;
                else delete prototype['comment'];
                if (creationDate.value) {
                    var date = Date.parse(creationDate.value) / 1000;
                    if (!isNaN(date))
                        prototype['creation date'] = date;
                }
                else delete prototype['creation date'];
                if (createdBy.value)
                    prototype['created by'] = createdBy.value;
                else delete prototype['created by'];
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
                else delete prototype['info']['private'];
                create(source.value, prototype, savePath, fileName);
                if (saveDefaults.checked)
                    setPrototype(prototype);
            } else {
                notify('Error', 'You must enter a valid source URL');
                source.focus();
            }
        });

        listen(saveAsButton, 'click', event => {
            if (source.validity.valid)
                saveAs(name.value || source.value);
        });

        // Prevent links from click navigation(redirection)
        listen('a', 'click', blockEvent);

    });
});

