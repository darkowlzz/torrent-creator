 /* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const { bencode, bdecode } = require('./bencode');

const equalObjects = (objA, objB) => {
    if (typeof objA === 'object' && typeof objB === 'object') {
        for (let property in objA) {
            if (typeof objA[property] === 'object' || typeof objB[property] === 'object') {
                if (!equalObjects(objA[property], objB[property]))
                    return false;
            }
            else if (objA[property] !== objB[property])
                return false
        }
        return true;
    }
    return false;
};

exports.testImports = assert => {
    assert.ok(bencode, 'bencode Function imported.');
    assert.ok(bdecode, 'bdecode Function imported.');
};

exports.testEmptyObject = assert =>
        assert.strictEqual(bencode({}), 'de', 'Bencoded empty Object literal to Dictionary.');

exports.testEmptyArray = assert =>
        assert.strictEqual(bencode([]), 'le', 'Bencoded empty Array literal to List.');

exports.testEmptyString = assert =>
        assert.strictEqual(bencode(''), '0:', 'Bencoded character less String literal.');

exports.testZeroNumber = assert =>
        assert.strictEqual(bencode(0), 'i0e', 'Bencoded falsy Number literal.');

exports.testEmptyDictionary = assert =>
        assert.ok(equalObjects(bdecode('de'), {}), 'Decoded empty Dictionary.');

exports.testEmptyList = assert =>
        assert.strictEqual(bdecode('le').length, 0, 'Decoded empty List.');

exports.testSingleNumber = assert =>
        assert.strictEqual(bdecode('i0e'), 0, 'Decoded single Number.');

exports.testEmptyString2 = assert =>
        assert.strictEqual(bdecode('0:'), '', 'Decoded empty String.');

exports.testBencode = assert => {
    assert.strictEqual(bencode({'test':'test'}), 'd4:test4:teste',
            'Encoded Object with single property.');
    assert.strictEqual(bencode([1, 2, 3, 4]), 'li1ei2ei3ei4ee',
            'Encoded Array of Numbers.');
    assert.strictEqual(bencode('This is a String'), '16:This is a String',
            'Encoded String correctly.');
    assert.strictEqual(bencode(23895389), 'i23895389e',
            'Encoded Number correctly.');
    let decoded = {a: { b: [{f:[['g', 6]]}], c: 'd', e: 5, h:[] }};
    let encoded = 'd1:ad1:bld1:fll1:gi6eeeee1:c1:d1:ei5e1:hleee';
    assert.strictEqual(bencode(decoded), encoded, 'Encoded Object with all types.');
    assert.ok(equalObjects(bdecode(encoded), decoded), 'Decoded subject with all types.');
};

exports.testDecode = assert => {
    assert.ok(equalObjects(bdecode('d4:test4:teste'), {'test':'test'}),
        'Decoded Dictionary correcty.');
    assert.ok(equalObjects(bdecode('li1ei2ei3ei4ee'), [1, 2, 3, 4]),
        'Decoded List correctly.');
    assert.strictEqual(bdecode('16:This is a String'), 'This is a String',
        'Decoded String correctly.');
    assert.strictEqual(bdecode('i23895389e'), 23895389,
        'Decoded Number correctly.');
};

require('sdk/test').run(exports);