//@ts-check

/*!
jsCASL2/jsCOMET2, CASLII/COMETII emulator implemented in Javascript.
Copyright (c) 2025, Ryota SUZUKI.

The codes are transpiled and modified from PyCASL2/PyCOMET2.

PyCOMET2 is COMET II emulator implemented in Python.
Copyright (c) 2012, Yasuaki Mitani.
Copyright (c) 2009, Masahiko Nakamoto.
All rights reserved.

Based on a simple implementation of COMET II emulator.
Copyright (c) 2001-2008, Osamu Mizuno.

This program is free software; you can redistribute it and/or
modify it under the terms of the GNU General Public License
as published by the Free Software Foundation; either version 2
of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, see
<https://www.gnu.org/licenses/>.
*/

class utils{

    /**
    * @param {number} x
    * @returns {number}
    * @throws {TypeError}
    */
    static l2a(x){
        //''' unsigned -> signed '''
        x &= 0xffff;
        let a=0;
        if(0x0000 <= x && x <= 0x7fff)
            a = x;
        else if(0x8000 <= x && x <= 0xffff)
            a = x - 2 ** 16;
        else
            throw new TypeError();
        return a;
    }


    /**
    * @param {number} x
    * @returns {number}
    */
    static a2l(x){
        //''' signed -> unsigned '''
        x &= 0xffff;
        if(0 <= x)
            return x;
        return x + 2 ** 16;
    }


    /**
    * @param {number} x
    * @param {number} n
    * @returns {number}
    */
    static get_bit(x, n){
        //''' xのnビット目の値を返す (最下位ビットがn = 0)'''
        if((x & (0x01 << n)) == 0)
            return 0;
        else
            return 1;
    }


    /**
    * @param {number} n
    * @param {number|null} fill
    * @returns {string}
    */
    static i2bin(n, fill=null){
        if(fill == null)
            return n.toString(2);
        else
            return ("0".repeat(fill)+n.toString(2)).slice(-fill);
    }

}