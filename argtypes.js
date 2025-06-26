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


class argtypes{
    static argtype(size=0, name=''){
        /** @param {(machine:Machine,addr:number)=>number[]} f */
        let _=function(f){
            /**
             * @param {Machine} machine 
             * @param {?number} addr 
             * @returns 
             */
            let __=function(machine, addr=null){
                /** @type {number} */
                let _addr;
                if(addr == null) _addr = machine.PR;
                else _addr=addr;
                return f(machine, _addr);
            };
            __.size = size;
            __.name_ = name;
            return __;
        };
        return _;
    };


    //@argtype(size=1)
    static noarg=argtypes.argtype(1, 'noarg')(function(machine, addr){
        return [];
    });


    //@argtype(size=1)
    static r=argtypes.argtype(1, 'r')(function(machine, addr){
        let a = machine.memory[addr];
        return [(0x00f0 & a) >> 4];
    });


    //@argtype(size=1)
    static r1r2=argtypes.argtype(1, 'r1r2')(function(machine, addr){
        let a = machine.memory[addr];
        let r1 = ((0x00f0 & a) >> 4);
        let r2 = (0x000f & a);
        return [r1, r2];
    });


    //@argtype(size=2)
    static adrx=argtypes.argtype(2, 'adrx')(function(machine, addr){
        let a = machine.memory[addr];
        let b = machine.memory[addr + 1];
        let x = (0x000f & a);
        let adr = b;
        return [adr, x];
    });


    //@argtype(size=2)
    static radrx=argtypes.argtype(2, 'radrx')(function(machine, addr){
        let a = machine.memory[addr];
        let b = machine.memory[addr + 1];
        let r = ((0x00f0 & a) >> 4);
        let x = (0x000f & a);
        let adr = b;
        return [r, adr, x];
    });


    //@argtype(size=3)
    static strlen=argtypes.argtype(3, 'strlen')(function(machine, addr){
        let s = machine.memory[addr + 1];
        let l = machine.memory[addr + 2];
        return [s, l];
    });
}