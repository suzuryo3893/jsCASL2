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


/** @typedef {{print(v):void,error(v):void}} JSConsole */
/** @typedef {{console:JSConsole}} JSComet */
/** @type {JSComet} */
//let jscomet;

class Disassembler{

    constructor(machine){
        this.m = machine;
    }

    disassemble=function*(addr, num=16){
        for(let i=0;i<num;++i){
            try{
                let inst = this.m.get_instruction(addr);
                yield [addr, this.dis_inst(addr)];
                if(1 < inst.argtype.size)
                    yield [addr + 1, ''];
                if(2 < inst.argtype.size)
                    yield [addr + 2, ''];
                addr += inst.argtype.size;
            }
            catch(e){//except InvalidOperation:
                if(e instanceof InvalidOperation){
                    yield [addr, this.dis_inst(addr)];
                    addr += 1;
                }
                else throw e;
            }
        }
    }

    dis_inst(addr){
        try{
            let inst = this.m.get_instruction(addr);
            let args = inst.argtype(this.m, addr);
            let prop_name='dis_' + inst.argtype.name_;
            if(prop_name in this) return this[prop_name](inst, ...args);
            else return this.dis_dc(addr);
        }
        catch(e){
            throw e;
            //return this.dis_dc(addr);
        }
    }

    dis_noarg(inst){
        //return '%--8s' % inst.opname;
        //return jsComet2.lsps(8,inst.opname);
        return inst.opname;
    }

    dis_r(inst, r){
        //return '%-8sGR%1d' % (inst.opname, r);
        //return jsComet2.lsps(8,inst.opname)+"GR"+jsComet2.spd(r);
        return inst.opname+" GR"+r;
    }

    dis_r1r2(inst, r1, r2){
        //return '%-8sGR%1d, GR%1d' % (inst.opname, r1, r2);
        //return jsComet2.lsps(8,inst.opname)+"GR"+jsComet2.spd(r1)+", GR"+jsComet2.spd(r2);
        return inst.opname+" GR"+r1+", GR"+r2;
    }

    dis_adrx(inst, adr, x){
        // if(x == 0) return '%-8s#%04x' % (inst.opname, adr);
        // else return '%-8s#%04x, GR%1d' % (inst.opname, adr, x);
        // if(x == 0) return jsComet2.lsps(8,inst.opname)+"#"+jsComet2.zpx(4,adr);
        // else return jsComet2.lsps(8,inst.opname)+"#"+jsComet2.zpx(4,adr)+", GR"+jsComet2.zpd(1,x);
        if(x == 0) return inst.opname+" #"+jsComet2.zpx(4,adr);
        else       return inst.opname+" #"+jsComet2.zpx(4,adr)+", GR"+x;
    }

    dis_radrx(inst, r, adr, x){
        // if(x == 0) return '%-8sGR%1d, #%04x' % (inst.opname, r, adr);
        // else return '%-8sGR%1d, #%04x, GR%1d' % (inst.opname, r, adr, x);
        // if(x == 0) return jsComet2.lsps(8,inst.opname)+"GR"+jsComet2.zpd(r)+", "+jsComet2.zpx(4,adr);
        // else return jsComet2.lsps(8,inst.opname)+"GR"+jsComet2.zpd(r)+", "+jsComet2.zpx(4,adr)+", GR"+jsComet2.zpd(x);
        if(x == 0) return inst.opname+" GR"+r+", #"+jsComet2.zpx(4,adr);
        else       return inst.opname+" GR"+r+", "+jsComet2.zpx(4,adr)+", GR"+x;
    }

    dis_strlen(inst, s, l){
        //return '%-8s#%04x, #%04x' % (inst.opname, s, l);
        //return jsComet2.lsps(8,inst.opname)+"#"+jsComet2.zpx(4,s)+", #"+jsComet2.zpx(4,l);
        return inst.opname+" #"+jsComet2.zpx(4,s)+", #"+jsComet2.zpx(4,l);
    }

    dis_dc(addr){
        //return '%-8s#%04x' % ('DC', this.m.memory[addr]);
        return 'DC'+" #"+jsComet2.zpx(4,this.m.memory[addr]);
    }
}


class StatusMonitor{
    constructor(machine){
        this.m = machine;
        this.vars = [];
        this.watch('%04d: ', 'step_count');
        this.decimalFlag = false;
    }

    //@override
    toString(){
        //return ' '.join([v() for v in self.vars])
        return this.vars.map(v=>v()).join(' ');
    }

    //TODO:書式どうしたもんかね．
    /**
     * 
     * @param {string} fmt 
     * @param {string} attr 
     * @param {number?} index 
     */
    watch(fmt, attr, index=null){
        let _f = function(){
            if(index == null)
                //return fmt % this.m[attr];
                return sprintf(fmt,this.m[attr]);
            else
                //return fmt % this.m[attr][index];
                return sprintf(fmt,this.m[attr][index])
        }
        _f.__name__ = 'watcher_' + attr;
        if(index != null) _f.__name__ += '[' + index + ']';
        this.vars.push(_f);
    }

    push(s){
        try{
            if(s == 'PR') this.watch("PR=#%04x", 'PR');
            else if(s == 'OF') this.watch("OF=#%01d", 'OF');
            else if(s == 'SF') this.watch("SF=#%01d", 'SF');
            else if(s == 'ZF') this.watch("ZF=#%01d", 'ZF');
            else if(s.slice(0,2) == 'GR'){
                let reg = parseInt(s[2]);
                if(reg < 0 || 8 < reg)
                    throw new InvalidOperation("");
                if(this.decimalFlag)
                    this.watch("GR" + reg.toString() + "=#%d", 'GR', reg);
                else
                    this.watch("GR" + reg.toString() + "=#%04x", 'GR', reg);
            }
            else{
                let adr = this.m.cast_int(s);
                if(adr < 0 || 0xffff < adr)
                    throw new InvalidOperation("");
                if(this.decimalFlag)
                    this.watch("#"+jsComet2.zpx(adr) + "=%d", 'memory', adr);
                else
                    this.watch("#"+jsComet2.zpx(adr) + "=%04x", 'memory', adr);
            }
        }
        catch(e){//ValueError:
            if(e instanceof InvalidOperation){
                jscomet.console.error("Warning: Invalid monitor "+
                                    "target is found." +
                                    ` ${s} is ignored.`);
            }
            else throw e;
        }
    }
}

class InvalidOperation extends Error{
    constructor(address){
        super();
        this.address = address;
    }

    //@override
    toString(){
        return 'Invalid operation is found at #'+jsComet2.zpx(this.address)+'.';
    }
}


class MachineExit extends Error{
    constructor(machine){
        super();
        this.machine = machine;
    }
}



class jsComet2{
    static zpd(n,t){
        return (("0".repeat(n))+t.toString(10)).slice(-n);
    }
    static zpx(n,t){
        return (("0".repeat(n))+t.toString(16)).slice(-n);
    }
    static spd(n,t){
        return ((" ".repeat(n))+t.toString(10)).slice(-n);
    }
    static lsps(n,t){
        return (t+(" ".repeat(n))).slice(n);
    }
    static sps(n,t){
        return ((" ".repeat(n))+t).slice(-n);
    }
    
    //# スタックポインタの初期値
    static initSP = 0xff00;

    constructor(){
        /** @type {Array<any>} */
        this.inst_list = [instructions.nop,   instructions.ld2,   instructions.st,    instructions.lad, instructions.ld1,
                          instructions.adda2, instructions.suba2, instructions.addl2, instructions.subl2,
                          instructions.adda1, instructions.suba1, instructions.addl1, instructions.subl1,
                          instructions.and2,  instructions.or2,   instructions.xor2,  instructions.and1, instructions.or1, instructions.xor1,
                          instructions.cpa2,  instructions.cpl2,  instructions.cpa1,  instructions.cpl1,
                          instructions.sla,   instructions.sra,   instructions.sll,   instructions.srl,
                          instructions.jmi,   instructions.jnz,   instructions.jze,   instructions.jump, instructions.jpl, instructions.jov,
                          instructions.push,  instructions.pop,   instructions.call,  instructions.ret, instructions.svc,
                          instructions.in_,   instructions.out,   instructions.rpush, instructions.rpop];

        this.inst_table = {};
        for(let ir of this.inst_list){
            //this.inst_table[ir.opcode] = new MethodType(ir, this, jsComet2); //TODO:インスタンスにメソッドを後付けぶち込みたいらしい  # inject method "ir" in self of PyComet2 (jsComet2)this; jsComet2.'ir'=function(){}
            //this.inst_table[ir.opcode] = new Object();
            //this.inst_table[ir.opcode][ir.name] = ir;
            this.inst_table[ir.opcode] = ir;
        }

        this.is_auto_dump = false;
        this.is_count_step = false;
        this.break_points = [];
        this.call_level = 0;
        this.step_count = 0;
        this.monitor = new StatusMonitor(this);
        this.dis = new Disassembler(this);
        this.current_inst = null;

        /** @type {Array<number>} */
        this.memory = [];
        /** @type {Array<number>} */
        this.GR = [];
        //# スタックポインタ SP = GR[8]
        /** @type {number} */
        this.SP=0;
        //# プログラムレジスタ
        this.PR = 0;
        //# Overflow Flag
        this.OF = 0;
        //# Sign Flag
        this.SF = 0;
        //# Zero Flag
        this.ZF = 1;

        this.initialize();
    }

    initialize(){
        //# 主記憶 1 word = 2 byte unsigned short
        //this.memory = array.array('H', [0] * 65536);
        this.memory = new Array(65536).fill(0);
        //# レジスタ unsigned short
        this.GR = new Array(9).fill(0);
        //# スタックポインタ SP = GR[8]
        this.SP = jsComet2.initSP;
        //# プログラムレジスタ
        this.PR = 0;
        //# Overflow Flag
        this.OF = 0;
        //# Sign Flag
        this.SF = 0;
        //# Zero Flag
        this.ZF = 1;
        jscomet.console.print('Initialize memory and registers.');

        this.prevPR = this.PR;
    }

    //@property
    get FR(){
        return this.OF << 2 | this.SF << 1 | this.ZF;
    }
    set FR(_fr){
        this.ZF=_fr&1;
        this.SF=(_fr>>1)&1;
        this.OF=(_fr>>2)&1;
    }

    get SP(){
        return this.GR[8];
    }
    set SP(value){
        this.GR[8] = value;
    }

    set_logging_level(lv){
        //logging.basicConfig(level=lv);
    }

    //# PRが指す命令を返す
    get_instruction(adr=null){
        try{
            return this.inst_table[(this.memory[adr==null?this.PR:adr] & 0xff00) >> 8];
        }
        catch(e){//except KeyError:
            throw new InvalidOperation(adr);
        }
    }

    //# 命令を1つ実行
    step(){
        this.prevPR = this.PR;
        let current_inst=this.get_instruction();
        current_inst(this);
        this.step_count += 1;
    }

    watch(variables, decimalFlag=false){
        this.monitor.decimalFlag = decimalFlag;
        for(let v of variables.split(","))
            this.monitor.push(v);

        while (true){
            if(this.PR in this.break_points)
                break;
            else{
                try{
                    jscomet.console.print(this.monitor);
                    //jscomet.console.flush();
                    this.step();
                }
                catch(e){//except InvalidOperation, e:
                    jscomet.console.error(e);
                    this.dump(e.address);
                    break;
                }
            }
        }
    }

    run(){
        while (true){
            if(this.PR in this.break_points)
                break;
            else
                this.step();
        }
    }

    // //# オブジェクトコードを主記憶に読み込む
    // load(filename, quiet=false){
    //     if(!quiet)
    //         jscomet.console.error(`load ${filename} ...`);
    //     this.initialize();
    //     let fp = file(filename, 'rb');
    //     let tmp=[];
    //     try{
    //         tmp.fromfile(fp, 65536);
    //     }
    //     catch(e){//except EOFError
    //         //pass;
    //     }
    //     fp.close();
    //     tmp.byteswap();
    //     this.PR = tmp[2];
    //     tmp = tmp.slice(8);
    //     for(let i;i<tmp.length;++i)
    //         this.memory[i] = tmp[i];
    //     if(!quiet)
    //         jscomet.console.error('done.');
    // }

    /**
     * 
     * @param {number[]} code_list 
     * @param {boolean} quiet 
     */
    load(code_list, quiet=false){
        if(!quiet)
            jscomet.console.error("load code ...");
        this.initialize();
        //let fp = file(filename, 'rb');
        // try{
        //     //tmp.fromfile(fp, 65536);
        // }
        // catch(e){//except EOFError
        //     //pass;
        // }
        // fp.close();
        // tmp.byteswap();
        let tmp=code_list;
        this.PR = tmp[2];
        this.prevPR = this.PR;
        tmp = tmp.slice(8);
        for(let i=0;i<tmp.length;++i)
            this.memory[i] = tmp[i];
        if(!quiet)
            jscomet.console.error('done.');
    }


    exit(){
        throw new MachineExit(this);
    }

    cast_int(addr){
        if(addr[0] == '#')
            return parseInt(addr.slice(1), 16);
        else
            return parseInt(addr);
    }

    dump_memory(start_addr=0x0000, lines=0xffff / 8){
        // let printable = (string.letters
        //              + string.digits
        //              + string.punctuation + ' ');
        let printable = "abcdefghijklmnopqrstuvwxyz" 
                     + "ABCDEFGHIJKLMNOPQRSTUVWXYZ"
                     + "0123456789"
                     + "!\"#$%&'()*+,-./:;<=>?@[\\]^_`{|}~" + ' ';

        let to_char=function(array){
            let chr2=function(i){
                let c = 0x00ff & i;
                //return chr(c) if chr(c) in printable else '.';
                let _c = String.fromCharCode(c);
                return printable.includes(_c) ? _c : '.';
            }
            //return ''.join([chr2(i) for i in array])
            return array.map(i=>chr2(i)).join('');
        };

        let to_hex=function(array){
            //return ' '.join(['%04x' % i for i in array])
            return array.map(i=>jsComet2.zpx(4,i)).join(' ');
        }

        let st = [];
        for(let i=0;i<lines;++i){
            let addr = i * 8 + start_addr;
            if(0xffff < addr) return st;
            //st.append('%04x: %-39s %-8s\n'
            //          % (addr,
            //             to_hex(self.memory[addr:addr + 8]),
            //             to_char(self.memory[addr:addr + 8])))
            st.push(""+jsComet2.zpx(4,addr)+": "+jsComet2.lsps(39,to_hex(this.memory.slice(addr,addr+8)))+" "+jsComet2.lsps(8,to_char(this.memory.slice(addr,addr+8)))+"\n");
        }
        return st.join('');
    }

    //# 8 * 16 wordsダンプする
    dump(start_addr=0x0000){
        jscomet.console.print(this.dump_memory(start_addr, 16));
    }

    dump_stack(){
        jscomet.console.print(this.dump_memory(this.SP, 16));
    }

    // dump_to_file(filename, lines=0xffff / 8){
    //     let fp = file(filename, 'w');
    //     fp.write(`Step count: ${this.step_count}\n`);
    //     fp.write('PR: #'+zpx(4,this.PR)+'\n');
    //     fp.write('SP: #'+zpx(4,this.SP)+'\n');
    //     fp.write('OF: '+zpx(1,this.OF)+'\n');
    //     fp.write('SF: '+zpx(1,this.SF)+'\n');
    //     fp.write('ZF: '+zpx(1,this.ZF)+'\n');
    //     for(let i;i<8;++i)
    //         fp.write('GR'+i+': #'+zpx(4,this.GR[i])+'\n');
    //     fp.write('Memory:\n');
    //     fp.write(this.dump_memory(0, lines));
    //     fp.close();
    // }

    disassemble(start_addr=0x0000){
        let addr = start_addr;
        let dis = null;
        //for(addr, dis in self.dis.disassemble(addr, 16))
        for([addr, dis] of this.dis.disassemble(addr, 16)){
            jscomet.console.error('#'+jsComet2.zpx(4,addr)+'\t#'+jsComet2.zpx(4,this.memory[addr])+'\t'+dis);
        }
    }

    disassemble_current(){
        return this.dis.dis_inst(this.prevPR);
    }

    set_break_point(addr){
        if(addr in this.break_points)
            jscomet.console.error('#'+jsComet2.zpx(4,addr)+' is already set.');
        else
            this.break_points.push(addr);
    }

    print_break_points(){
        if(this.break_points.length == 0)
            jscomet.console.error('No break points.');
        else{
            //for(let[i, addr] in enumerate(self.break_points))
            for(let i=0;i<this.break_points.length;++i){
                let addr = this.break_points[i];
                jscomet.console.error(''+i+': #'+jsComet2.zpx(4,addr));
            }
        }
    }

    delete_break_points(n){
        if(0 <= n && n < this.break_points.length)
            jscomet.console.error('#'+jsComet2.zpx(4,this.break_points[n])+' is removed.');
        else
            jscomet.console.error('Invalid number is specified.');
    }

    write_memory(addr, value){
        this.memory[addr] = value;
    }

    jump(addr){
        this.PR = addr;
        this.print_status();
    }

    print_status(){
        let code=null;
        try{
            code = this.dis.dis_inst(this.PR);
        }
        catch(e){//except InvalidOperation:
            code = jsComet2.zpx(4,this.memory[this.PR]);
        }
        //jscomet.console.error('PR  #'+zpx(4,this.PR)+` [ %-30s ]  STEP %d\n'
        jscomet.console.error('PR  #'+jsComet2.zpx(4,this.PR)+' [ '+jsComet2.lsps(30,code)+` ]  STEP ${this.step_count}}\n`);
        //jscomet.console.error('SP  #%04x(%7d) FR(OF, SF, ZF)  %03s  (%7d)\n'
        jscomet.console.error('SP  #'+jsComet2.zpx(4,this.SP)+'('+jsComet2.spd(7,this.SP)+') FR(OF, SF, ZF)  '+jsComet2.sps(3,utils.i2bin(this.FR,3))+'  ('+jsComet2.spd(7,this.FR)+')\n');
        jscomet.console.error('GR0 #'+jsComet2.zpx(4,this.GR[0])+'('+jsComet2.spd(7,utils.l2a(this.GR[0]))+') GR1 #'+jsComet2.zpx(4,this.GR[1])+'('+jsComet2.spd(7,utils.l2a(this.GR[1]))+') '+
                         ' GR2 #'+jsComet2.zpx(4,this.GR[2])+'('+jsComet2.spd(7,utils.l2a(this.GR[2]))+') GR3: ##'+jsComet2.zpx(4,this.GR[3])+'('+jsComet2.spd(7,utils.l2a(this.GR[3]))+')\n');
        jscomet.console.error('GR4 #'+jsComet2.zpx(4,this.GR[4])+'('+jsComet2.spd(7,utils.l2a(this.GR[4]))+') GR5 #'+jsComet2.zpx(4,this.GR[5])+'('+jsComet2.spd(7,utils.l2a(this.GR[5]))+') '+
                         'GR6 #'+jsComet2.zpx(4,this.GR[6])+'('+jsComet2.spd(7,utils.l2a(this.GR[6]))+') GR7: #'+jsComet2.zpx(4,this.GR[7])+'('+jsComet2.spd(7,utils.l2a(this.GR[7]))+')\n');
    }

    wait_for_command(self){
        while(true){
            let line="";
            try{
                //line = raw_input('pycomet2> ').strip();
            }
            catch(e){//except EOFError:
                //print;
                break;
            }
            if(line == '') continue;
            try{
                let args = line.split(/\s/);
                if(line[0] == 'q')
                    break;
                else if(line[0] == 'b'){
                    if(2 <= args.length)
                        this.set_break_point(this.cast_int(args[1]));
                }
                else if(line.slice(0,2) == 'df'){
                    // this.dump_to_file(args[1]);
                    // jscomet.console.error('dump to' + filename);
                }
                else if(line.slice(0,2) == 'di'){
                    if(args.length == 1)
                        this.disassemble();
                    else
                        this.disassemble(this.cast_int(args[1]));
                }
                else if(line.slice(0,2) == 'du'){
                    if(args.length == 1)
                        this.dump();
                    else
                        this.dump(this.cast_int(args[1]));
                }
                else if(line[0] == 'd'){
                    if(2 <= args.length)
                        this.delete_break_points(parseInt(args[1]));
                }
                else if(line[0] == 'h')
                    this.print_help();
                else if(line[0] == 'i')
                    this.print_break_points();
                else if(line[0] == 'j')
                    this.jump(this.cast_int(args[1]));
                else if(line[0] == 'm')
                    this.write_memory(this.cast_int(args[1]),
                                      this.cast_int(args[2]));
                else if(line[0] == 'p')
                    this.print_status();
                else if(line[0] == 'r')
                    this.run();
                else if(line.slice(0,2) == 'st')
                    this.dump_stack();
                else if(line[0] == 's'){
                    this.step();
                    this.print_status();
                }
                else
                    jscomet.console.error('Invalid command', args[0]);
            }
            catch(e){
                //except (IndexError, ValueError):
                if(e instanceof RangeError || e instanceof EvalError)
                    jscomet.console.error("Invalid arguments", args.slice(1).join(', '));
                //except InvalidOperation as e:
                else if(e instanceof InvalidOperation){
                    jscomet.console.error(e);
                    this.dump(e.address);
                    break;
                }
                else if(e instanceof MachineExit){
                //except MachineExit as e:
                    if(this.is_count_step)
                        jscomet.console.print('Step count:' + self.step_count);
                    if(this.is_auto_dump){
                        //jscomet.console.print("dump last status to last_state.txt");
                        //this.dump_to_file('last_state.txt');
                    }
                    break;
                }
                else throw e;
            }
        }
    }

    print_help(){
        jscomet.console.error('b ADDR        Set a breakpoint at specified address.');
        jscomet.console.error('d NUM         Delete breakpoints.');
        jscomet.console.error('di ADDR       Disassemble 32 words from specified address.');
        jscomet.console.error('du ADDR       Dump 128 words of memory.');
        jscomet.console.error('h             Print help.');
        jscomet.console.error('i             Print breakpoints.');
        jscomet.console.error('j ADDR        Set PR to ADDR.');
        jscomet.console.error('m ADDR VAL    Change the memory at ADDR to VAL.');
        jscomet.console.error('p             Print register status.');
        jscomet.console.error('q             Quit.');
        jscomet.console.error('r             Strat execution of program.');
        jscomet.console.error('s             Step execution.');
        jscomet.console.error('st            Dump 128 words of stack image.');
    }
}
