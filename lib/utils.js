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
|*| Functions shared between multiple modules.
|*|
\*/

// Create WeakMap Accessor
const accessor = () => {
    let map = new WeakMap();
    return (target, value) => {
        if (value)
            map.set(target, value);
        return map.get(target);
    };
};


exports.accessor = accessor;

// Utility function to copy object(s)'s properties to another object
// without modifying those objects. Its a deep copy operation.
// Object property precedence is from right to left.
const merge = (...objects) => {
    if (objects.length) {
        let toObj = objects.shift(); // The first argument
        if (toObj) {
            objects.forEach(object => { // Loop through the remaing objects
                if (object) {
                    object = Object.create(object); // Create a new object that inherits from object
                    for (let property in object) {
                        if (typeof object[property] !== 'object')
                            toObj[property] = object[property];
                        else if (typeof toObj[property] === 'object')
                            merge(toObj[property], object[property]);
                        else toObj[property] = object[property];
                    }
                }
            });
        }
        return toObj;
    }
};

exports.merge = merge;

// Used to define properties that are not enumerable and will remain as such.
// If you use this on a contructor's prototype then when an object is
// constructed with said function(contructor) that property will be readable
// and writable but not enumerable during its lifetime.
let properties = new WeakMap();
const privateProperties = target => {
    let object = properties.get(target);
    if (object === void(0))
        properties.set(target, object = {});
    return object;
};
const definePrivateProperty = (object, name) => {
    Object.defineProperty(object, name, {
        __proto__: null,
        get: function () {
            return privateProperties(this)[name];
        },
        set: function (value) {
            privateProperties(this)[name] = value;
        }
    });
};

// This definition of private is not enumerable, configurable, or writable.
// The exception being that a setter and getter will be defined for the property.
// This makes the fact that the property is not writable transparent.
// Objects that inherit private properties maintain the fore-mentioned attributes.
exports.definePrivateProperty = definePrivateProperty;

// Converts an Enumeration to an Array
const enumToArray = (enumerator) => {
    let array = new Array();
    while (enumerator.hasMoreElements())
        array.push(enumerator.getNext());
    return array;
};

exports.enumToArray = enumToArray;