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


/** @typedef {jsComet2} Machine */

class instructions{

    /**
     * @param {Machine} m 
     * @param {number} adr 
     * @param {number} x 
     * @returns {number}
     */
    static get_effective_address(m, adr, x){
        //''' 実効アドレスを返す '''
        //return adr if x == 0 else a2l(adr + m.GR[x])
        return x == 0 ? adr : utils.a2l(adr + m.GR[x]);
    }


    /**
     * @param {Machine} m 
     * @param {number} adr 
     * @param {number} x 
     * @returns {number}
     */
    static get_value_at_effective_address(m, adr, x){
        //''' 実効アドレス番地の値を返す '''
        //return m.memory[adr] if x == 0 else m.memory[a2l(adr + m.GR[x])]
        return x == 0 ? m.memory[adr] : m.memory[utils.a2l(adr + m.GR[x])];
    }

    /**
     * @param {number} result 
     * @param {boolean} logical 
     * @param {number?} ZF 
     * @param {number?} SF 
     * @param {number?} OF 
     * @returns {Array<number>}
     */
    static flags(result, logical=false, ZF=null, SF=null, OF=null){
        // '''
        // 計算結果に応じたフラグを返す
        // 論理演算の場合は第二引数をTrueにする
        // '''
        let [_ZF,_SF,_OF]=[false,false,false];
        if(ZF == null) _ZF = (result == 0);
        if(SF == null) _SF = (utils.get_bit(result, 15) == 0);
        if(OF == null){
            if(logical)
                _OF = (result < 0 || 0xffff < result);
            else
                _OF = (result < -32768 || 0x7fff < result);
        }
        //return map(int, (ZF, SF, OF));
        return [_ZF, _SF, _OF].map((e)=>e?1:0);
    }

    static Jump = class extends Error{
        /**
         * @param {number} addr 
         * @param {number?} result 
         */
        constructor(addr, result=null){
            super();
            this.addr = addr;
            this.result = result;
        }
    }

    /**
     * @typedef {{(machine:Machine,addr?:number|null):number[],size:number}} Argtype
     */
    /**
     * @param {number} opcode 
     * @param {string} opname 
     * @param {Argtype} argtype 
     * @returns 
     */
    static instruction(opcode, opname, argtype){
        /** @param {(m:Machine, ...vargs:number[])=>number[]|void} ir */
        let _ = function(ir){
            /**
             * @param {Machine} machine 
             * @returns {void}
             */
            let __ = function(machine){
                let isCatched=false;
                let result=null;
                try{
                    result = ir(machine, ...argtype(machine));
                }
                //except Jump as jump:
                catch(jump){
                    if(jump instanceof instructions.Jump){
                        machine.PR = jump.addr;
                        result = jump.result;
                        isCatched=true;
                    }
                    else throw jump;
                }
                finally{
                    if(!isCatched)
                        machine.PR += argtype.size;
                }
                if(result != null){
                    machine.ZF = result[0] == null ? machine.ZF : result[0];
                    machine.SF = result[1] == null ? machine.SF : result[1];
                    machine.OF = result[2] == null ? machine.OF : result[2];
                }
            };
            __.opcode = opcode;
            __.opname = opname;
            __.argtype = argtype;
            return __;
        };
        return _;
    }



    //@instruction(0x00, 'NOP', noarg)
    static nop=instructions.instruction(0x00, 'NOP', argtypes.noarg)(function(machine){
    })


    //@instruction(0x10, 'LD', radrx)
    static ld2=instructions.instruction(0x10, 'LD', argtypes.radrx)(function(machine, r, adr, x){
        machine.GR[r] = instructions.get_value_at_effective_address(machine, adr, x);
        return instructions.flags(machine.GR[r], false, null, null, 0);
    })


    //@instruction(0x11, 'ST', radrx)
    static st=instructions.instruction(0x11, 'ST', argtypes.radrx)(function(machine, r, adr, x){
        machine.memory[instructions.get_effective_address(machine, adr, x)] = machine.GR[r];
    })


    //@instruction(0x12, 'LAD', radrx)
    static lad=instructions.instruction(0x12, 'LAD', argtypes.radrx)(function(machine, r, adr, x){
        machine.GR[r] = instructions.get_effective_address(machine, adr, x);
    })


    //@instruction(0x14, 'LD', r1r2)
    static ld1=instructions.instruction(0x14, 'LD', argtypes.r1r2)(function(machine, r1, r2){
        machine.GR[r1] = machine.GR[r2];
        return instructions.flags(machine.GR[r1], false, null, null, 0);
    })


    //@instruction(0x20, 'ADDA', radrx)
    static adda2=instructions.instruction(0x20, 'ADDA', argtypes.radrx)(function(machine, r, adr, x){
        let v = instructions.get_value_at_effective_address(machine, adr, x);
        let result = utils.l2a(machine.GR[r]) + utils.l2a(v);
        machine.GR[r] = utils.a2l(result);
        return instructions.flags(result);
    })


    //@instruction(0x21, 'SUBA', radrx)
    static suba2=instructions.instruction(0x21, 'SUBA', argtypes.radrx)(function(machine, r, adr, x){
        let v = instructions.get_value_at_effective_address(machine, adr, x);
        let result = utils.l2a(machine.GR[r]) - utils.l2a(v);
        machine.GR[r] = utils.a2l(result);
        return instructions.flags(result);
    })


    //@instruction(0x22, 'ADDL', radrx)
    static addl2=instructions.instruction(0x22, 'ADDL', argtypes.radrx)(function(machine, r, adr, x){
        let v = instructions.get_value_at_effective_address(machine, adr, x);
        let result = machine.GR[r] + v;
        machine.GR[r] = result & 0xffff;
        return instructions.flags(result, true);
    })


    //@instruction(0x23, 'SUBL', radrx)
    static subl2=instructions.instruction(0x23, 'SUBL', argtypes.radrx)(function(machine, r, adr, x){
        let v = instructions.get_value_at_effective_address(machine, adr, x);
        let result = machine.GR[r] - v;
        machine.GR[r] = result & 0xffff;
        return instructions.flags(result, true);
    })


    //@instruction(0x24, 'ADDA', r1r2)
    static adda1=instructions.instruction(0x24, 'ADDA', argtypes.r1r2)(function(machine, r1, r2){
        let result = utils.l2a(machine.GR[r1]) + utils.l2a(machine.GR[r2]);
        machine.GR[r1] = utils.a2l(result);
        return instructions.flags(result);
    });


    //@instruction(0x25, 'SUBA', r1r2)
    static suba1=instructions.instruction(0x25, 'SUBA', argtypes.r1r2)(function(machine, r1, r2){
        let result = utils.l2a(machine.GR[r1]) - utils.l2a(machine.GR[r2]);
        machine.GR[r1] = utils.a2l(result);
        return instructions.flags(result);
    })


    //@instruction(0x26, 'ADDL', r1r2)
    static addl1=instructions.instruction(0x26, 'ADDL', argtypes.r1r2)(function(machine, r1, r2){
        let result = machine.GR[r1] + machine.GR[r2];
        machine.GR[r1] = result & 0xffff;
        return instructions.flags(result, true);
    })


    //@instruction(0x27, 'SUBL', r1r2)
    static subl1=instructions.instruction(0x27, 'SUBL', argtypes.r1r2)(function(machine, r1, r2){
        let result = machine.GR[r1] - machine.GR[r2];
        machine.GR[r1] = result & 0xffff;
        return instructions.flags(result, true);
    })


    //@instruction(0x30, 'AND', radrx)
    static and2=instructions.instruction(0x30, 'AND', argtypes.radrx)(function(machine, r, adr, x){
        let v = instructions.get_value_at_effective_address(machine, adr, x);
        machine.GR[r] = machine.GR[r] & v;
        return instructions.flags(machine.GR[r], false,null,null,0);
    })


    //@instruction(0x31, 'OR', radrx)
    static or2=instructions.instruction(0x31, 'OR', argtypes.radrx)(function(machine, r, adr, x){
        let v = instructions.get_value_at_effective_address(machine, adr, x);
        machine.GR[r] = machine.GR[r] | v;
        return instructions.flags(machine.GR[r], false,null,null,0);
    })


    //@instruction(0x32, 'XOR', radrx)
    static xor2=instructions.instruction(0x32, 'XOR', argtypes.radrx)(function(machine, r, adr, x){
        let v = instructions.get_value_at_effective_address(machine, adr, x);
        machine.GR[r] = machine.GR[r] ^ v;
        return instructions.flags(machine.GR[r], false,null,null,0);
    })


    //@instruction(0x34, 'AND', r1r2)
    static and1=instructions.instruction(0x34, 'AND', argtypes.r1r2)(function(machine, r1, r2){
        machine.GR[r1] = machine.GR[r1] & machine.GR[r2];
        return instructions.flags(machine.GR[r1], false,null,null,0);
    })


    //@instruction(0x35, 'OR', r1r2)
    static or1=instructions.instruction(0x35, 'OR', argtypes.r1r2)(function(machine, r1, r2){
        machine.GR[r1] = machine.GR[r1] | machine.GR[r2];
        return instructions.flags(machine.GR[r1], false,null,null,0);
    })


    //@instruction(0x36, 'XOR', r1r2)
    static xor1=instructions.instruction(0x36, 'XOR', argtypes.r1r2)(function(machine, r1, r2){
        machine.GR[r1] = machine.GR[r1] ^ machine.GR[r2];
        return instructions.flags(machine.GR[r1], false,null,null,0);
    })


    //@instruction(0x40, 'CPA', radrx)
    static cpa2=instructions.instruction(0x40, 'CPA', argtypes.radrx)(function(machine, r, adr, x){
        let v = instructions.get_value_at_effective_address(machine, adr, x);
        let diff = utils.l2a(machine.GR[r]) - utils.l2a(v);
        return [diff==0?1:0, diff<0?1:0, 0];
    })


    //@instruction(0x41, 'CPL', radrx)
    static cpl2=instructions.instruction(0x41, 'CPL', argtypes.radrx)(function(machine, r, adr, x){
        let v = instructions.get_value_at_effective_address(machine, adr, x);
        let diff = machine.GR[r] - v;
        return [diff == 0?1:0, diff < 0?1:0, 0];
    })


    //@instruction(0x44, 'CPA', r1r2)
    static cpa1=instructions.instruction(0x44, 'CPA', argtypes.r1r2)(function(machine, r1, r2){
        let diff = utils.l2a(machine.GR[r1]) - utils.l2a(machine.GR[r2]);
        return [diff == 0?1:0, diff < 0?1:0, 0];
    })


    //@instruction(0x45, 'CPL', r1r2)
    static cpl1=instructions.instruction(0x45, 'CPL', argtypes.r1r2)(function(machine, r1, r2){
        let diff = machine.GR[r1] - machine.GR[r2];
        return [diff == 0?1:0, diff < 0?1:0, 0];
    })


    //@instruction(0x50, 'SLA', radrx)
    static sla=instructions.instruction(0x50, 'SLA', argtypes.radrx)(function(machine, r, adr, x){
        let v = instructions.get_effective_address(machine, adr, x);
        let p = utils.l2a(machine.GR[r]);
        let prev_p = p;
        let sign = utils.get_bit(machine.GR[r], 15);
        let ans = (p << v) & 0x7fff;
        if(sign == 0)
            ans = ans & 0x7fff;
        else
            ans = ans | 0x8000;
        machine.GR[r] = ans;
        if(0 < v)
            return instructions.flags(machine.GR[r], false, null, null, utils.get_bit(prev_p, 15 - v));
        else
            return instructions.flags(machine.GR[r]);
    })


    //@instruction(0x51, 'SRA', radrx)
    static sra=instructions.instruction(0x51, 'SRA', argtypes.radrx)(function(machine, r, adr, x){
        let v = instructions.get_effective_address(machine, adr, x);
        let p = utils.l2a(machine.GR[r]);
        let prev_p = p;
        let sign = utils.get_bit(machine.GR[r], 15);
        let ans = (p >> v) & 0x7fff;
        if(sign == 0)
            ans = ans & 0x7fff;
        else
            ans = ans | 0x8000;
        machine.GR[r] = ans;
        if(0 < v)
            return instructions.flags(machine.GR[r], false,null,null,utils.get_bit(prev_p, v - 1));
        else
            return instructions.flags(machine.GR[r]);
    })


    //@instruction(0x52, 'SLL', radrx)
    static sll=instructions.instruction(0x52, 'SLL', argtypes.radrx)(function(machine, r, adr, x){
        let v = instructions.get_effective_address(machine, adr, x);
        let p = machine.GR[r];
        let prev_p = p;
        let ans = p << v;
        ans = ans & 0xffff;
        machine.GR[r] = ans;
        if(0 < v)
            return instructions.flags(machine.GR[r], true,
                        null,null,utils.get_bit(prev_p, 15 - (v - 1)));
        else
            return instructions.flags(machine.GR[r], true);
    })


    //@instruction(0x53, 'SRL', radrx)
    static srl=instructions.instruction(0x53, 'SRL', argtypes.radrx)(function(machine, r, adr, x){
        let v = instructions.get_effective_address(machine, adr, x);
        let p = machine.GR[r];
        let prev_p = p;
        let ans = machine.GR[r] >> v;
        ans = ans & 0xffff;
        machine.GR[r] = ans;
        if(0 < v)
            return instructions.flags(machine.GR[r], false, null,null,utils.get_bit(prev_p, (v - 1)));
        else
            return instructions.flags(machine.GR[r]);
    })


    //@instruction(0x61, 'JMI', adrx)
    static jmi=instructions.instruction(0x61, 'JMI', argtypes.adrx)(function(machine, adr, x){
        if(machine.SF == 1)
            throw new instructions.Jump(instructions.get_effective_address(machine, adr, x));
    })


    //@instruction(0x62, 'JNZ', adrx)
    static jnz=instructions.instruction(0x62, 'JNZ', argtypes.adrx)(function(machine, adr, x){
        if(machine.ZF == 0)
            throw new instructions.Jump(instructions.get_effective_address(machine, adr, x));
    })


    //@instruction(0x63, 'JZE', adrx)
    static jze=instructions.instruction(0x63, 'JZE', argtypes.adrx)(function(machine, adr, x){
        if(machine.ZF == 1)
            throw new instructions.Jump(instructions.get_effective_address(machine, adr, x));
    })


    //@instruction(0x64, 'JUMP', adrx)
    static jump=instructions.instruction(0x64, 'JUMP', argtypes.adrx)(function(machine, adr, x){
        throw new instructions.Jump(instructions.get_effective_address(machine, adr, x));
    })


    //@instruction(0x65, 'JPL', adrx)
    static jpl=instructions.instruction(0x65, 'JPL', argtypes.adrx)(function(machine, adr, x){
        if(machine.ZF == 0 && machine.SF == 0)
            throw new instructions.Jump(instructions.get_effective_address(machine, adr, x));
    })


    //@instruction(0x66, 'JOV', adrx)
    static jov=instructions.instruction(0x66, 'JOV', argtypes.adrx)(function(machine, adr, x){
        if(machine.OF == 0)
            throw new instructions.Jump(instructions.get_effective_address(machine, adr, x));
    })


    //@instruction(0x70, 'PUSH', adrx)
    static push=instructions.instruction(0x70, 'PUSH', argtypes.adrx)(function(machine, adr, x){
        machine.SP -= 1;
        machine.memory[machine.SP] = instructions.get_effective_address(machine, adr, x);
    })


    //@instruction(0x71, 'POP', r)
    static pop=instructions.instruction(0x71, 'POP', argtypes.r)(function(machine, r){
        machine.GR[r] = machine.memory[machine.SP];
        machine.SP += 1;
    })


    //@instruction(0x80, 'CALL', adrx)
    static call=instructions.instruction(0x80, 'CALL', argtypes.adrx)(function(machine, adr, x){
        machine.SP -= 1;
        machine.memory[machine.SP] = machine.PR;
        machine.call_level += 1;
        throw new instructions.Jump(instructions.get_effective_address(machine, adr, x));
    })


    //@instruction(0x81, 'RET', noarg)
    static ret=instructions.instruction(0x81, 'RET', argtypes.noarg)(function(machine){
        if(machine.call_level == 0){
            machine.step_count += 1;
            machine.exit();
        }
        let adr = machine.memory[machine.SP];
        machine.SP += 1;
        machine.call_level -= 1;
        throw new instructions.Jump(adr + 2);
    })


    //@instruction(0xf0, 'SVC', adrx)
    static svc=instructions.instruction(0xf0, 'SVC', argtypes.adrx)(function(machine, adr, x){
        throw new instructions.Jump(machine.PR);
    })


    //@instruction(0x90, 'IN', strlen)
    static in_=instructions.instruction(0x90, 'IN', argtypes.strlen)(function(machine, s, l){
        jscomet.console.print('-> ');
        //sys.stderr.flush();
        //let line = sys.stdin.readline();
        //let line = jscomet.console.readline();
        let line = "";
        line = line.slice(0,-1);
        if(256 < line.length)
            line = line.slice(0,256);
        machine.memory[l] = line.length;
        for(let i=0;i<line.length;++i){//, ch in enumerate(line))
            machine.memory[s + i] = line.charCodeAt(i);
        }
    })


    //@instruction(0x91, 'OUT', strlen)
    static out=instructions.instruction(0x91, 'OUT', argtypes.strlen)(function(machine, s, l){
        let length = machine.memory[l];
        let ch = '';
        for(let i=s;i<s+length;++i)
            ch += String.fromCharCode(machine.memory[i]);
        jscomet.console.print(ch);
    })


    //@instruction(0xa0, 'RPUSH', noarg)
    static rpush=instructions.instruction(0xa0, 'RPUSH', argtypes.noarg)(function(machine){
        for(let i=1;i<9;++i){
            machine.SP -= 1;
            machine.memory[machine.SP] = machine.GR[i];
        }
    })


    //@instruction(0xa1, 'RPOP', noarg)
    static rpop=instructions.instruction(0xa1, 'RPOP', argtypes.noarg)(function(machine){
        for(let i=8;i>=1;--i){
            machine.GR[i] = machine.memory[machine.SP];
            machine.SP += 1;
        }
    })

}
