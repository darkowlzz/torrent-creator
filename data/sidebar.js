/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

const notify = (title, text) => addon.port.emit('alert', title, text);

window.addEventListener('load', event => {
    // Select source on click.
    const source = document.querySelector('#source > input');
    source.addEventListener('focus', event => source.select());

    // Drag and drop source
    window.addEventListener('dragenter', event => event.preventDefault());
    window.addEventListener('dragover', event => event.preventDefault());
    // On drop set the source input value and set the mode
    window.addEventListener('drop', event =>
            addon.port.emit('get-type',
            source.value = event.dataTransfer.getData('text/x-moz-url')));

    // Single or multiple file torrent mode selection
    const multiMode = document.querySelector('#mode > div > #multi');
    const singleMode = document.querySelector('#mode > div > #single');
    // Initial mode
    singleMode.checked = true;
    // Toggle mode
    multiMode.addEventListener('click', event => singleMode.checked = false);
    singleMode.addEventListener('click', event => multiMode.checked = false);

    // Port on fileURL result of nsIFilePicker
    addon.port.on('source', fileURL => source.value = fileURL);

    // Port on result of get-type
    addon.port.on('set-type', isDirectory => {
        singleMode.checked = !isDirectory;
        multiMode.checked = isDirectory;
    });

    // On click invoke nsIFilePicker
    document.querySelector('#source > img').addEventListener('click', event =>
            addon.port.emit('select-source', multiMode.checked));

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

    // On click emit the create event to main with the source and prototype arguments
    document.querySelector('#button-create').addEventListener('click', event => {
        if (source.validity.valid) {
            var prototype = {info:{}};
            if (comment.value)
                prototype['comment'] = comment.value;
            if (creationDate.value)
                prototype['creation date'] = creationDate.value;
            if (createdBy.value)
                prototype['created by'] = createdBy.value;
            if (pieceLength.value)
                prototype['info']['piece length'] = pieceLength.value;
            if (name.value)
                prototype['info']['name'] = name.value;
            if (privateOpt.checked)
                prototype['info']['private'] = 1;
            addon.port.emit('create', source.value, prototype);
        } else notify('Error', 'You must enter a valid URL');
        event.preventDefault();
        event.stopImmediatePropagation();
    });

    // Prevent links and images from being dragged.
    colToArr(document.querySelectorAll('img, a')).forEach(element =>
            element.addEventListener('mousedown', event => {
                event.preventDefault();
                event.stopImmediatePropagation();
                return false;
            }));

});