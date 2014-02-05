/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

// Helper functions
const notify = (title, text) => addon.port.emit('alert', title, text);

const getType = fileURL => addon.port.emit('get-type', fileURL);

const getPrototype = () => addon.port.emit('get-prototype');

const setPrototype = prototype => addon.port.emit('set-prototype', prototype);

const selectSource = mode => addon.port.emit('select-source', mode);

const saveAs = url => addon.port.emit('save-as', url);

const create = (source, prototype, path, name) =>
        addon.port.emit('create', source, prototype, path, name);

const receive = (...args) => addon.port.on.apply(addon.port, args);

const hide = (...elements) => elements.forEach(element =>
        element.style = 'display:none !important;');

const show = (...elements) => elements.forEach(element =>
        element.style = 'display:initial !important;');

const colToArr = collection => Array.prototype.slice.call(collection);

const listen = (selector, type, listener, useCapture) => {
    var elements = null;
    if (!selector)
        throw new TypeError('Invalid selector!')
    else if (typeof selector !== 'string')
        elements = [selector];
    else elements = colToArr(document.querySelectorAll(selector));
    elements.forEach(element =>
        element.addEventListener(type, listener, !!useCapture));
};

const getDate = date => {
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

const blockEvent = event => {
    event.preventDefault();
    event.stopImmediatePropagation();
};

// An array to store option objects defined below.
// Use: Hide/Show input elements
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
    listen(option.label, 'focus', event => {
        option.label.addEventListener('mouseover', mouseHandler, false);
        option.showInput()
    }, false);
    listen(option.label, 'mouseover', mouseHandler, false);
    // Allow tabbing to other inputs when the mouse has stolen focus
    listen(option.input, 'mouseenter', event => option.mouseTrap = true);
    listen(option.input, 'mouseleave', event => option.mouseTrap = false);
    listen(option.input, 'keydown', event => {
        var tabKey = 9;
        if (event.keyCode === tabKey && option.mouseTrap)
            option.label.removeEventListener('mouseover', mouseHandler, false);
    });
    // Give the option label a checkmark when its not empty.
    listen(option.input, 'input', event => {
        if (option.value !== '')
            option.label.setAttribute('class', 'option-label checkmark');
        else option.label.setAttribute('class', 'option-label');
    });
    // Hide the editable input when it loses focus.
    listen(option.input, 'blur', event => option.hideInput(), false);
    // Prevent the label from accepting input
    listen(option.label, 'input', event => option.label.value = '');
    // Set the initial state
    option.hideInput();
    // Add this option to the list and return the option.
    options.push(option);
    return option;
};
