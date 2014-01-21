/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

module.metadata = {
  'stability': 'stable'
};

function decode(string, index = 0, recursive) {
    decode.iterations = recursive ? ++decode.iterations : 0;
    if (decode.iterations > string.length)
        throw new Error('Reached implied maximum recursion level - Invalid Bencoded Data!');
    let decoded, char = string[index];
    if (char === 'd')
        decoded = decodeDictionary(string, ++index);
    else if (char === 'l')
        decoded = decodeList(string, ++index);
    else if (char === 'i')
        decoded = decodeInteger(string, ++index);
    else if (char >= 0 && char <= 9)
        decoded = decodeString(string, index);
    else {
        decoded = {
            data: null,
            index: null
        };
        console.exception(new TypeError('Encountered an invalid data type identifier - Invalid Bencoded Data!'));
    }
    if (!recursive)
        return decoded.data;
    return decoded;
}

function decodeDictionary(string, index) {
    let dictionary = {}, decoded;
    do {
        let colon = getColonIndex(string, index);
        let count = parseInt(string.substr(index, colon));
        let key = string.substr(++colon, count);
        decoded = decode(string, colon + count, true);
        dictionary[key] = decoded.data;
        if (!decoded.index)
            return {
                'data': dictionary,
                'index': null
            };
        index = decoded.index;
        if (string[index] === 'e')
            return {
                'data': dictionary,
                'index': index + 1
            };
    } while (index <= string.length);
}

function decodeList(string, index) {
    let list = [], decoded;
    do {
        decoded = decode(string, index, true);
        list.push(decoded.data);
        if (!decoded.index)
            return {
                'data': list,
                'index': null
            };
        index = decoded.index;
        if (string[index] === 'e')
            return {
                'data': list,
                'index': index + 1
            };
    } while (index <= string.length);
}

function getColonIndex(string, index) {
    for (let char = index; char < string.length; char++) {
        if (string[char] === ':') 
            return char;
    }
}

function decodeInteger(string, index) {
    let sliceOfString = string.slice(index);
    let end = sliceOfString.indexOf('e');
    let num = sliceOfString.substr(0, end);
    return {
        'data': parseInt(num),
        'index': index + end + 1
    };
}

function decodeString(string, index) {
    let colon = getColonIndex(string, index);
    let count = parseInt(string.substr(index, colon));
    colon++;
    string = string.substr(colon, count);
    return {
        'data': string,
        'index': colon + count
    };
}

function isType(type, obj) {
    let clas = Object.prototype.toString.call(obj).slice(8, -1);
    return obj !== undefined && obj !== null && clas === type;
}

function encode(obj) {
    let encoded = '';
    if (isType('String', obj)) // String
        encoded = obj.length + ':' + obj;
    else if (isType('Object', obj)) { // Dictionary
        for (let key in obj)
            encoded += encode(key) + encode(obj[key]);
        encoded = 'd' + encoded + 'e';
    }
    else if (isType('Array', obj)) { // List
        for (let i = 0; i < obj.length; i++)
            encoded += encode(obj[i]);
        encoded = 'l' + encoded + 'e';
    }
    else if (isType('Number', obj)) // Integer
        encoded = 'i' + obj + 'e';
    return encoded;
}

exports.bdecode = decode;
exports.bencode = encode;
