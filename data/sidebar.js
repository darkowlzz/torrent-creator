/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

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

    // Port on fileURL result or nsIFilePicker
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
    const colToArr = collection => Array.prototype.slice.apply(collection, 0);

    const options = [];

    const hideOptions = (excludeIndex = -1) => options.forEach((option, index) => {
        if (index !== excludeIndex)
            option.hideInput();
    });

    const getOption = id => {
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
            get value() this.input.value
        };
        option.label.addEventListener('focus', event => option.showInput(), false);
        option.label.addEventListener('mouseover', event => option.showInput(), false);
        option.input.addEventListener('blur', event => option.hideInput(), false);
        option.input.addEventListener('input', event => {
            if (option.value !== '')
                option.label.setAttribute('class', 'option-label checkmark');
            else option.label.setAttribute('class', 'option-label');
        });
        option.hideInput();
        options.push(option);
        return option;
    };

    const comment = getOption('comment');
    const name = getOption('name');
    const privateOpt = getOption('private');
    const createdBy = getOption('created-by');
    const creationDate = getOption('creation-date');
    const pieceLength = getOption('piece-length');

    document.querySelector('#button-create').addEventListener('click', event =>
        addon.port.emit('create', source.value));

});