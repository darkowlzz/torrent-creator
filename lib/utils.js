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

// Create WeakMap Accessor Constructor
const accessor = () => {
    let map = new WeakMap();
    return (target, value) => {
        if (value)
            map.set(target, value);
        return map.get(target);
    };
};


exports.accessor = accessor;