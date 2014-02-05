/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

const notify = (title, text) => addon.port.emit('alert', title, text);
const getType = fileURL => addon.port.emit('get-type', fileURL);
const getPrototype = () => addon.port.emit('get-prototype');
const setPrototype = prototype => addon.port.emit('set-prototype', prototype);
const selectSource = mode => addon.port.emit('select-source', mode);
const saveAs = (url) => addon.port.emit('save-as', url);
const create = (source, prototype, path) =>
        addon.port.emit('create', source, prototype, path);
const receive = (...args) => addon.port.on.apply(addon.port, args);
const listenFor = (selector, event, handler, capture) =>
        document.querySelector(selector).addEventListener(event, handler, capture);

const getDate = (date) => {
    date = new Date(date || Date());
    var dateString = date.getMonth()+1 + '/' +
                     date.getDate() + '/' +
                     date.getFullYear() + ' ';
    var hours = date.getHours(), suffix = 'AM';
    if (hours > 12) {
        hours -= 12;
        suffix = 'PM'
    }
    dateString += hours + ':' +
            date.getMinutes() + ':' +
            date.getSeconds() + ' ';
    return dateString + suffix;
};


window.addEventListener('load', event => {
    // Select source on click.
    const source = document.querySelector('#source > input');
    source.addEventListener('focus', event => source.select());
    var savePath = '';
    // Drag and drop source
    window.addEventListener('dragenter', event => event.preventDefault());
    window.addEventListener('dragover', event => event.preventDefault());
    // On drop set the source input value and set the mode
    window.addEventListener('drop', event => {
        var value = event.dataTransfer.getData('text/x-moz-url');
        getType(source.value = value.split('\n')[0]);
    });

    // Single or multiple file torrent mode selection
    const multiMode = document.querySelector('#multi');
    const singleMode = document.querySelector('#single');
    // Initial mode
    singleMode.checked = true;
    // Toggle mode
    multiMode.addEventListener('click', event => singleMode.checked = false);
    singleMode.addEventListener('click', event => multiMode.checked = false);

    // Port on fileURL result of nsIFilePicker
    receive('source', fileURL => source.value = fileURL);
    receive('path', path => savePath = path);

    // Port on result of get-type
    receive('type', isDirectory => {
        singleMode.checked = !isDirectory;
        multiMode.checked = isDirectory;
    });

    // On click invoke nsIFilePicker
    listenFor('#source > img', 'click', event => selectSource(multiMode.checked));

    // Text areas
    const trackers = document.querySelector('#trackers > textarea');
    trackers.addEventListener('blur', event => trackers.scrollLeft = trackers.scrollTop = 0);
    const webSeeds = document.querySelector('#web-seeds > textarea');
    webSeeds.addEventListener('blur', event => webSeeds.scrollLeft = webSeeds.scrollTop = 0);

    // Helper functions
    const hide = (...elements) => elements.forEach(element =>
            element.style = 'display:none !important;');
    const show = (...elements) => elements.forEach(element =>
            element.style = 'display:initial !important;');
    const colToArr = collection => Array.prototype.slice.call(collection);

    const options = [];

    const hideOptions = (excludeIndex = -1) => options.forEach((option, index) => {
        if (index !== excludeIndex)
            option.hideInput();
    });

    const getOption = id => {
        // Construct the option object.
        var option = {
            label: document.querySelector('#' + id + ' > input:nth-of-type(1)'),
            input: document.querySelector('#' + id + ' > input:nth-of-type(2)'),
            showInput: function () {
                hide(this.label);
                show(this.input);
                var excludeIndex = options.indexOf(this);
                hideOptions(excludeIndex);
                this.input.focus();
            },
            hideInput: function () {
                hide(this.input);
                show(this.label);
            },
            get value() this.input.value,
            set value(value) this.input.value = value,
            mouseTrap: false
        };
        // If the focus event occurs then the mouseover listener has been removed.
        var mouseHandler = event => option.showInput();
        option.label.addEventListener('focus', event => {
            option.label.addEventListener('mouseover', mouseHandler, false);
            option.showInput()
        }, false);
        option.label.addEventListener('mouseover', mouseHandler, false);
        // Allow tabbing to other inputs when the mouse has stolen focus
        option.input.addEventListener('mouseenter', event => option.mouseTrap = true);
        option.input.addEventListener('mouseleave', event => option.mouseTrap = false);
        option.input.addEventListener('keydown', event => {
            var tabKey = 9;
            if (event.keyCode === tabKey && option.mouseTrap)
                option.label.removeEventListener('mouseover', mouseHandler, false);
        });
        // Give the option label a checkmark when its not empty.
        option.input.addEventListener('input', event => {
            if (option.value !== '')
                option.label.setAttribute('class', 'option-label checkmark');
            else option.label.setAttribute('class', 'option-label');
        });
        // Hide the editable input when it loses focus.
        option.input.addEventListener('blur', event => option.hideInput(), false);
        // Prevent the label from accepting input
        option.label.addEventListener('input', event => option.label.value = '');
        // Set the initial state
        option.hideInput();
        // Add this option to the list and return the option.
        options.push(option);
        return option;
    };

    // Setup event listeners
    const comment = getOption('comment');
    const name = getOption('name');
    const privateOpt = document.querySelector('#private');
    const createdBy = getOption('created-by');
    const creationDate = getOption('creation-date');
    const pieceLength = getOption('piece-length');
    const saveDefaults = document.querySelector('#save-defaults');
    
    // Prevent links and images from being dragged.
    colToArr(document.querySelectorAll('img, a')).forEach(element =>
            element.addEventListener('mousedown', event => {
                event.preventDefault();
                event.stopImmediatePropagation();
            }));

    getPrototype();
    receive('prototype', prototype => {

        // Apply defaults
        comment.value = prototype['comment'] || '';
        name.value = prototype['name'] || '';
        pieceLength.value = prototype['piece length'] || '';
        privateOpt.checked = !!prototype['info']['private'];
        createdBy.value = prototype['created by'] || '';
        creationDate.value = getDate(prototype['creation date'] * 1000);

        listenFor('#save-defaults', 'click', event => {
                if (saveDefaults.checked)
                    notify('Note', 'Your settings will be saved after successful torrent creation.')
        });

        // On click emit the create event to main with the source and prototype arguments
        listenFor('#button-create', 'click', event => {
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
                create(source.value, prototype, savePath);
                if (saveDefaults.checked)
                    setPrototype(prototype);
            } else {
                notify('Error', 'You must enter a valid source URL');
                source.focus();
            }
            event.preventDefault();
            event.stopImmediatePropagation();
        });

        listenFor('#button-save-as', 'click', event => {
            saveAs(name.value || source.value);
            event.preventDefault();
            event.stopImmediatePropagation();
        });

    });
});

