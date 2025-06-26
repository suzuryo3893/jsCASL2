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


const op_tokens = new Set([
    'NOP', 'LD', 'ST', 'LAD', 'ADDA', 'SUBA', 'ADDL', 'SUBL',
    'AND', 'OR','XOR', 'CPA', 'CPL', 'SLA', 'SRA', 'SLL', 'SRL',
    'JMI', 'JNZ', 'JZE', 'JUMP', 'JPL', 'JOV', 'PUSH', 'POP',
    'CALL', 'RET', 'SVC', 'START', 'END', 'DC', 'DS',
    'IN', 'OUT', 'RPUSH', 'RPOP'
]);

const [noarg, r, r1r2, adrx, radrx, ds, dc, strlen, start] = [0, 1, 2, 3, 4, 5, 6, 7, 8];

/** @type {Object.<string, number>} */
const reg_str = Object.fromEntries([...Array(9)].map((_,i)=>['GR'+i,i]));

const op_table = {
    'NOP'  : [0x00, noarg],
    'LD2'  : [0x10, radrx],
    'ST'   : [0x11, radrx],
    'LAD'  : [0x12, radrx],
    'LD1'  : [0x14, r1r2],
    'ADDA2': [0x20, radrx],
    'SUBA2': [0x21, radrx],
    'ADDL2': [0x22, radrx],
    'SUBL2': [0x23, radrx],
    'ADDA1': [0x24, r1r2],
    'SUBA1': [0x25, r1r2],
    'ADDL1': [0x26, r1r2],
    'SUBL1': [0x27, r1r2],
    'AND2' : [0x30, radrx],
    'OR2'  : [0x31, radrx],
    'XOR2' : [0x32, radrx],
    'AND1' : [0x34, r1r2],
    'OR1'  : [0x35, r1r2],
    'XOR1' : [0x36, r1r2],
    'CPA2' : [0x40, radrx],
    'CPL2' : [0x41, radrx],
    'CPA1' : [0x44, r1r2],
    'CPL1' : [0x45, r1r2],
    'SLA'  : [0x50, radrx],
    'SRA'  : [0x51, radrx],
    'SLL'  : [0x52, radrx],
    'SRL'  : [0x53, radrx],
    'JMI'  : [0x61, adrx],
    'JNZ'  : [0x62, adrx],
    'JZE'  : [0x63, adrx],
    'JUMP' : [0x64, adrx],
    'JPL'  : [0x65, adrx],
    'JOV'  : [0x66, adrx],
    'PUSH' : [0x70, adrx],
    'POP'  : [0x71, r],
    'CALL' : [0x80, adrx],
    'RET'  : [0x81, noarg],
    'SVC'  : [0xf0, adrx],
    'IN'   : [0x90, strlen],
    'OUT'  : [0x91, strlen],
    'RPUSH': [0xa0, noarg],
    'RPOP' : [0xa1, noarg],
    'LD'   : [-1, 0],
    'ADDA' : [-2, 0],
    'SUBA' : [-3, 0],
    'ADDL' : [-4, 0],
    'SUBL' : [-5, 0],
    'AND'  : [-6, 0],
    'OR'   : [-7, 0],
    'XOR'  : [-8, 0],
    'CPA'  : [-9, 0],
    'CPL'  : [-10, 0],
    'START': [-100, start],
    'END'  : [-101, 0],
    'DS'   : [0, ds],
    'DC'   : [0, dc]
};


/**
 * @abstract unsigned -> signed
 * @param {number} x 
 * @returns {number}
 */
function l2a(x){
    x &= 0xffff;
    let a = 0;
    if(0x0000 <= x && x <= 0x7fff){
        a = x;
    }
    else if(0x8000 <= x && x <= 0xffff){
        a = x - 2**16;
    }
    else{
        throw new TypeError();
    }
    return a;
}

/**
 * @abstract signed -> unsigned
 * @param {number} x
 * @returns {number}
 */ 
function a2l(x){
    x &= 0xffff;
    if(0 <= x)
        return x;
    return x + 2**16;
}

class CASL2_Instruction{
    /** @type {string|null} */
    label;
    /** @type {string} */
    op;
    /** @type {Array<string>|null} */
    args;
    /** @type {number} */
    line_number;
    /** @type {string} */
    src;

    /**
     * @constructor
     * @param {string|null} label 
     * @param {string} op 
     * @param {Array<string>|null} args 
     * @param {number} line_number 
     * @param {string} src 
     */
    constructor(label, op, args, line_number, src){
        this.label = label;
        this.op = op;
        this.args = args;
        this.line_number = line_number;
        this.src = src;
    }

    //@override
    toString(){
        //return '%d: %s, %s, %s' % (self.line_number, self.label, self.op, self.args);
        return ""+this.line_number+": "+this.label+", "+this.op+", "+this.args;
    }
}

class CASL2_Label{
    /** @type {string} */
    label;
    /** @type {number} */
    lines;
    /** @type {string} */
    filename;
    /** @type {number} */
    addr;
    /** @type {string} */
    goto;

    /**
     * @param {string} label 
     * @param {number} lines 
     * @param {string} filename 
     * @param {number} addr 
     * @param {string} goto 
     */
    constructor(label, lines=0, filename='', addr=0, goto=''){
        this.label = label;
        this.lines = lines;
        this.filename = filename;
        this.addr = addr;
        this.goto = goto;
    }

    //@override
    toString(){
        const [_scope, _label] = this.label.split('.');
        let s="";
        if(_scope.length == 0)
            //s = '%s:%d\t%04x\t%s' % (self.filename, self.lines, self.addr, label)
            s = ""+this.filename+":"+this.lines+"\t"+CASL2.zpx(4,this.addr)+"\t"+_label;
        else
            //s = '%s:%d\t%04x\t%s (%s)' % (self.filename, self.lines, self.addr, label, scope)
            s = ""+this.filename+":"+this.lines+"\t"+CASL2.zpx(4,this.addr)+"\t"+_label+" ("+_scope+")";
        return s;
    }
}

class CASL2_ByteCode{
    /** @type {Array<number|string>} */
    code;
    /** @type {number} */
    addr;
    /** @type {number} */
    line_number;
    /** @type {string} */
    src;

    /**
     * @param {Array<number|string>} code 
     * @param {number} addr 
     * @param {number} line_number 
     * @param {string} src 
     */
    constructor(code, addr, line_number, src){
        this.code = code;
        this.addr = addr;
        this.line_number = line_number;
        this.src = src;
    }

    //@override
    toString(){
        let s="";
        if(this.code.length > 0){
            //s = '%04x\t%04x\t\t%d\t%s' % (self.addr, self.code[0], self.line_number, self.src);
            s = ""+CASL2.zpx(4,this.addr)+"\t"+CASL2.zpx(4,this.code[0])+"\t\t"+this.line_number+"\t"+this.src;
        }
        else{
            s = ""+CASL2.zpx(4,this.addr)+"\t    \t\t"+this.line_number+"\t"+this.src;
        }

        if(this.code.length > 1){
            s += '\n';
            if(Number.isInteger(this.code[1])){
                //s += '%04x\t%04x' % (self.addr+1, self.code[1]);
                s += ""+CASL2.zpx(4,this.addr+1)+"\t"+CASL2.zpx(4,this.code[1]);
            }
            else{
                //s += '%04x\t%s' % (self.addr+1, self.code[1]);
                s += ""+CASL2.zpx(4,this.addr+1)+"\t"+this.code[1];
            }
        }

        if(this.code.length > 2){
            s += '\n';
            if(Number.isInteger(this.code[2])){
                //s += '%04x\t%04x' % (self.addr+2, self.code[2]);
                s += ""+CASL2.zpx(4,this.addr+2)+"\t"+CASL2.zpx(4,this.code[2]);
            }
            else{
                //s += '%04x\t%s' % (self.addr+2, self.code[2])
                s += ""+CASL2.zpx(4,this.addr+2)+"\t"+this.code[2];
            }
        }

        return s;
    }
}

class CASL2_Error extends Error{
    constructor(line_num, src, message, ...params){
        super(message, ...params);
        this.line_num = line_num;
        this.src = src;
        this.message = message;

        if (Error.captureStackTrace) {
            Error.captureStackTrace(this, CASL2_Error);
        }

        this.name = "CASL2_Error";
    }

    toString(){
        //jscomet.console.error(`Error: ${this.message}\nLine ${this.line_num}: ${this.src}`);
        return `Line ${this.line_num}: Error: ${this.message} ${this.src}`;
    }
}


/**
 * @namespace CASL2
 */
class CASL2{
    /** @type {Object.<string,CASL2_Label>} */
    symbols;
    /** @type {CASL2_Instruction} */
    next_line;
    /** @type {Array<function>} */
    gen_code_func;
    /** @type {number} */
    addr;
    /** @type {number} */
    label_count;
    /** @type {Array} */
    additional_dc = [];
    /** @type {number} */
    start_address;
    /** @type {boolean} */
    start_found;
    /** @type {string} */
    current_scope;
    /** @type {string} */
    filename;
    /** @type {number} */
    current_line_number;
    /** @type {string} */
    next_src;
    /** @type {Array} */
    tmp_code = [];
    /** @type {Array} */
    code;
    /** @type {number} */
    code_li = 0;

    /**
     * @abstract zero padding hex
     * @param {number} n 
     * @param {number} t 
     * @returns {string}
     */
    static zpx(n,t){
        return ("0".repeat(n) + t.toString(16)).slice(-n);
    }
    /**
     * @abstract zero padding dec
     * @param {number} n 
     * @param {number} t 
     * @returns {string}
     */
    static zpd(n,t){
        return ("0".repeat(n) + t.toString(10)).slice(-n);
    }

    /**
     * @abstract impl cmp func of python2
     * @param {any} a 
     * @param {any} a 
     * @returns {number}
     */
    static cmp(a, b){
        return ((a > b)?1:0) - ((a < b)?1:0);
    }

    constructor(){
        this.symbols = {};
        
        this.gen_code_func = [this.gen_code_noarg, this.gen_code_r, this.gen_code_r1r2,
                              this.gen_code_adrx, this.gen_code_radrx,
                              this.gen_code_ds, this.gen_code_dc, this.gen_code_strlen,
                              this.gen_code_start];

        this.addr = 0;
        this.label_count = 0;
        this.additional_dc = [];
        this.start_address = 0x0000;
        this.start_found = false;
        this.current_scope = '';

        this.filename="";

        this.current_line_number = -1;
        this.next_line = new CASL2_Instruction(null, "", null, -1, "");
        this.next_src = "";
        this.tmp_code = [];
        this.code = [];
        this.code_li = 0;
    }

    dump(a_code){
        //const addr = 0;
        jscomet.console.print('Addr\tOp\t\tLine\tSource code');
        for(let c of a_code){
            if(c.code.length != 0){
                if(c.code[0] == 0x4341){
                    continue;
                }
            }
            jscomet.console.print(c);
            //## print '%04x\t%04x\t\t%d\t%s' % (c.addr, c.code[0], c.line_number, c.src)
            //## if 1 < len(c.code):
            //##     print '%04x\t%04x' % (c.addr+1, c.code[1])
            //## if 2 < len(c.code):
            //##     print '%04x\t%04x' % (c.addr+2, c.code[2])
            //## addr += len(c.code)
        }

        jscomet.console.print('\nDefined labels');
        let labels = Object.values(this.symbols);
        labels.sort((x, y)=>CASL2.cmp(x.lines, y.lines));
        for(let i of labels){
            jscomet.console.print(i);
        }
    }

    // assemble_fromFile(filename){
    // //TODO: file openしないからなぁ
    //     this.filename = filename;
    //     this.fp = file(filename, 'r');
    //     let code = this.fp.readlines();
    //     this.fp.close();
    //     return assemble(code);
    // }

    /**
     * @param {string} code 
     * @returns {CASL2_ByteCode[]}
     */
    assemble(code){
        this.symbols={};

        this.addr = 0;
        this.label_count = 0;
        this.additional_dc = [];
        this.start_address = 0x0000;
        this.start_found = false;
        this.current_scope = '';

        this.filename="";

        this.current_line_number = -1;
        this.next_line = new CASL2_Instruction(null, "", null, -1, "");
        this.next_src = "";
        this.tmp_code = [];
        this.code_li = 0;

        this.code = code.split('\n');

        try{
            this.get_line();
            this.is_valid_program();
        }
        catch(e){
            if(e instanceof CASL2_Error){
                // e.what();
                // sys.exit()
                // return null;
                throw e;
            }
            else{
                throw e;
            }
        }

        //## print >> sys.stderr, '-- First pass --'
        //## for i in self.tmp_code:
        //##     print >> sys.stderr, i

        let code_list=[];

        // ラベルをアドレスに置換。
        try{
            //code_list = [self.replace_label(code) for code in self.tmp_code if code != None]
            code_list = this.tmp_code.filter((code)=>code!=null).map((code)=>this.replace_label(code));
        }
        catch(e){
            if(e instanceof CASL2_Error){
                //e.what();
                //return null;
                throw e;
            }
            else{
                throw e;
            }
        }

        //# =記法のリテラル用コードを末尾に加える。
        //TODO:あやしい
        //code_list.extend(self.additional_dc)
        code_list = code_list.concat(this.additional_dc);

        //##   print >> sys.stderr, '-- Second pass --'
        //##   for i in code_list:
        //##       print >> sys.stderr, i

        return code_list;
    }

    is_valid_program(){
        // 構文解析
        while(true){
            if(!this.is_START()){
                throw new CASL2_Error(this.current_line_number,
                                 this.current_src,
                                 "START is not found.");
            }
            let is_data_exist = false;
            while(true){
                let ln = this.current_line_number;
                let src = this.current_src;
                let i = this.get_line();
                if(i.op == 'START'){
                    throw new CASL2_Error(ln, src, "START is found before END");
                }
                else if(i.op == 'END'){
                    break;
                }
                else if(i.op == 'EOF'){
                    throw new CASL2_Error(ln, src, "END is not found.");
                }
                else if(i.op == 'RET'){
                    if(is_data_exist)
                        throw new CASL2_Error(ln, src, "Data definition in program");
                    is_data_exist = false;
                }
                else if(['DC', 'DS'].includes(i.op)){
                    is_data_exist = true;
                }
                else if(!(i.op in op_table)){
                    throw new CASL2_Error(ln, src, "Invalid operation is found.")
                }
                this.tmp_code.push(this.convert(i));
            }
            if(this.next_line.op == "EOF")
                break;
        }
        return true;
    }

    get_line(){
        // 一行先読みする
        // コメントのみの行は読み飛ばす
        let current = this.next_line;
        this.current_src = this.next_src;
        let line="";

        while(true){
            if(this.code.length <= this.code_li){
                this.next_line = new CASL2_Instruction(null, "EOF", null, this.current_line_number+1, "");
                return current;
            }

            line = this.code[this.code_li++].trimEnd();
            this.current_line_number += 1;
            this.next_src = line;

            if(line.length == 0){
                this.next_line = new CASL2_Instruction(null, "EOF", null, this.current_line_number+1, "");
                return current;
            }

            line = line.split(';')[0].trimEnd();
            if(line.length > 0)
                break;
        }
        this.next_line = this.split_line(line, this.current_line_number+1);
        return current;
    }

    is_START(){
        let i = this.get_line();
        if(i.op != "START")
            return false;

        this.tmp_code.push(this.convert(i))

        return true;
    }

    is_RET(){
        let i = this.get_line();
        if(i.op != "RET")
            return false;

        this.tmp_code.push(this.convert(i));

        return true;
    }

    is_END(){
        let i = this.get_line();
        if(i.op != "END")
            return false;

        this.tmp_code.push(this.convert(i));

        return true;
    }

    is_DC_or_DS(){
        // DC, DS以外はエラー
        let i = this.get_line();
        if(!(i.op == "DC" || i.op == "DS"))
            return false;

        this.tmp_code.push(this.convert(i));

        return true;
    }

    is_valid_instruction(){
        //# DC, DS, END, STARTはエラー
        let i = this.get_line();
        if (i.op == "DC" || i.op == "DS" || i.op == "END" || i.op == "START")
            return false

        this.tmp_code.push(this.convert(i));

        return true;
    }

    /**
     * @param {CASL2_ByteCode} bcode 
     * @returns {CASL2_ByteCode} 
     */
    replace_label(bcode){
        // ラベルをアドレスに置換
        /**
         * @param {any} x 
         * @param {CASL2_ByteCode} bcode 
         * @returns {number} 
         */
        let conv=function(x, bcode){
            if(typeof x === 'string' || x instanceof String){
                let _x = /** @type {string} */(x);
                if(_x[0] == '=')
                    return this.gen_additional_dc(_x, bcode.line_number);
                
                let global_name = '.' + _x.split('.')[1];
                if(_x in this.symbols)
                    return this.symbols[_x].addr;
                //# スコープ内にないときは、スコープ名なしのラベルを探す
                else if(global_name in this.symbols){
                    if(this.symbols[global_name].goto == '')
                        return this.symbols[global_name].addr;
                    //# サブルーチンの実行開始番地が指定されていた場合、gotoに書かれているラベルの番地にする
                    else{
                        let label = this.symbols[global_name].goto;
                        if(label in this.symbols)
                            return this.symbols[label].addr;
                        else
                            throw new CASL2_Error(bcode.line_number, bcode.src, 'Undefined label "'+_x.split('.')[1]+'" was found.');
                    }
                }
                else
                    throw new CASL2_Error(bcode.line_number, bcode.src, 'Undefined label "'+x.split('.')[1]+'" was found.');
            }
            else
                return x;
        };

        return new CASL2_ByteCode(bcode.code.map(i=>conv.call(this,i,bcode)), bcode.addr, bcode.line_number, bcode.src);
    }

    remove_comment(file){
        //return [i for i in [(n+1, line[:-1].split(';')[0]) for n, line in enumerate(file)] if len(i[1]) > 0]
        return [...Array(file.length)].map((_,n)=>{[n+1, file[n].slice(0,-1).split(';')[0]]}).filter(i=>i[1].length>0);
    }


    split_line(line, line_number){
        //  行からラベル、命令、オペランドを取り出す

        //# check empty line
        let result = line.match(/^\s*$/);
        if(result != null)
            return [null, null, null];

        //TODO: DCが受け付けるので4引数以上対応にしたが，その影響は？
        const re_label = "(?<label>[A-Za-z_][A-Za-z0-9_]*)?"
        const re_op    = "\\s+(?<op>[A-Z]+)"
        const re_args    = "(\\s+(?<args>=?(([-#]?[A-Za-z0-9_]+)|('.*'))(\\s*,\\s*(=?(([-#]?[A-Za-z0-9_]+)|('.*'))))*))?"
        const re_comment = "(\\s*(;(?<comment>.+)?)?)?"
        const pattern = new RegExp("(^" + re_label + re_op + re_args + ")?" + re_comment)

        result = line.match(pattern)

        if(result == null){
            throw new CASL2_Error(line_number, line, "Invalid line was found.\n");
        }

        let label = result.groups['label'];
        let op = result.groups['op'];
        let args = null;
        if(result.groups["args"]!=null){
            args=result.groups["args"].split(/\s*,\s*/);
        }

        return new CASL2_Instruction(label, op, args, line_number, line);
    }

    register_label(inst){
        //''' ラベルをシンボルテーブルに登録する '''
        if(inst.label != null){
            let label_name = this.current_scope + '.' + inst.label;
            if(label_name in this.symbols){
                //jscomet.console.error(`Line ${inst.line_number}: Label "${inst.label}" is already defined.`);
                //return false; //sys.exit();
                //throw Error();
                throw new CASL2_Error(inst.line_number, "", `Label "${inst.label}" is already defined.`);
            }

            this.symbols[label_name] = new CASL2_Label(label_name, inst.line_number, this.filename, this.addr);
        }
        return true;
    }


    conv_noarg(args){
        return [null];
    }

    conv_r(args){
        return [reg_str[args[0]]];
    }

    conv_r1r2(args){
        return [reg_str[args[0]], reg_str[args[1]]];
    }

    conv_adrx(args){
        let addr = this.conv_adr(args[0])
        if(args.length == 1)
            return [addr, 0];
        return [addr, reg_str[args[1]]]
    }

    conv_radrx(args){
        let addr = this.conv_adr(args[1]);
        if(args.length == 2)
            return [reg_str[args[0]], addr, 0];
        return [reg_str[args[0]], addr, reg_str[args[2]]];
    }

    /** 
     * @param {string} addr
     */
    conv_adr(addr){
        let a = null;
        if(addr.match(/^-?[0-9]+$/) != null)
            a = a2l(parseInt(addr, 10));
        else if(addr.match(/^#[A-Za-z0-9]+$/) != null)
            a = parseInt(addr.slice(1), 16);
        else if(addr.match(/^[A-Za-z_][A-Za-z0-9_]*$/) != null)
            a = this.current_scope + '.' + addr;
        else if(addr.match(/^=.+$/) != null)
            a = addr;
        return a;
    }

    /** @returns {Array<number>} */
    gen_code_noarg(op, args){
        let code = [0];
        code[0] = (op_table[op][0] << 8);
        return code;
    }

    /** @returns {Array<number>} */
    gen_code_r(op, args){
        let code = [0];
        code[0] = ((op_table[op][0] << 8) | (this.conv_r(args)[0] << 4));
        return code;
    }

    /** @returns {Array<number>} */
    gen_code_r1r2(op, args){
        let code = [0];
        let [r1, r2] = this.conv_r1r2(args);
        code[0] = ((op_table[op][0] << 8) | (r1 << 4) | r2);
        return code;
    }

    /** @returns {Array<number>} */
    gen_code_adrx(op, args){
        let code = [0, 0];
        let [addr, x] = this.conv_adrx(args);
        code[0] = ((op_table[op][0] << 8) | (0 << 4) | x);
        code[1] = addr;
        return code;
    }

    /** @returns {Array<number>} */
    gen_code_radrx(op, args){
        let code = [0, 0];
        let [r, addr, x] = this.conv_radrx(args);
        code[0] = ((op_table[op][0] << 8) | (r << 4) | x);
        code[1] = addr;
        return code;
    }

    /** @returns {Array<number>} */
    gen_code_ds(op, args){
        let code = new Array(parseInt(args[0])).fill(0);
        return code;
    }

    gen_code_dc(op, args){
        //全ての引数を数値にして戻す
        let code=args.map(i=>this.cast_literal([i])[0])
        return code;
    }

    //# IN,OUT用
    gen_code_strlen(op, args){
        let code = [0, null, null];
        code[0] = (op_table[op][0] << 8);
        code[1] = this.conv_adr(args[0]);
        code[2] = this.conv_adr(args[1]);
        return code;
    }

    //# START用
    gen_code_start(op, args){
        let code = new Array(8).fill(0);
        // code[0] = (ord('C') << 8) + ord('A');
        // code[1] = (ord('S') << 8) + ord('L');
        code[0] = ('C'.charCodeAt(0) << 8) + 'A'.charCodeAt(0);
        code[1] = ('S'.charCodeAt(0) << 8) + 'L'.charCodeAt(0);
        if(args != null){
            let [addr, x] = this.conv_adrx(args);
            code[2] = addr;
        }
        return code;
    }

    cast_literal(arg){
        let value=[];
        if(arg[0] == '#')
            value = [parseInt(arg.slice(1), 16)];
        else if(arg[0] == '\'')
            //value = [ord(i) for i in arg[1:-1]];
            //value = arg.slice(1,-1).map(i=>i.charCodeAt(0));
            value = [arg.slice(1,-1).charCodeAt(0)];
        else
            value = [a2l(parseInt(arg))];
        return value;
    }

    //# ラベルの文字列を生成する
    gen_label(){
        let l = '_L' + CASL2.zpd(4,this.label_count);
        this.label_count += 1;
        return l;
    }

    //# =記法のリテラル用コードを生成する
    gen_additional_dc(x, n){
        let l = this.gen_label();
        let label_name = '.' + l;
        this.symbols[label_name] = new CASL2_Label(label_name, n, this.filename, this.addr);
        let cnst = this.cast_literal(x.slice(1));
        //code = array.array('H', const)
        let code = cnst;
        this.addr += code.length;
        //# self.additional_dc.append((code, n, '%s\tDC\t%s' % (l,x[1:])))
        this.additional_dc.push(new CASL2_ByteCode(code, this.symbols[label_name].addr, n, `${l}\tDC\t$`+ x.slice(1)));
        return this.symbols[label_name].addr;
    }


    /**
     * バイト列に変換
     * @param {CASL2_Instruction} inst 
     * @returns {?CASL2_ByteCode}
     */
    convert(inst){
        this.register_label(inst);

        try{
            if(inst.op == null)
                return null;

            if(typeof inst.op != "string" || inst.op instanceof String)
                //throw new TypeError();
                throw new CASL2_Error(inst.line_number, "", `Invalid instruction "${inst.op}" was found.`);
            
            if(-100 < op_table[inst.op][0]  && op_table[inst.op][0] < 0){
                if(this.is_arg_register(inst.args[1]))
                    inst.op += '1';
                else
                    inst.op += '2';
            }
            
            if(op_table[inst.op][0] == -100){
                if(inst.label == null){
                    //jscomet.console.error(`Line ${inst.line_number}: Label should be defined for START.`)
                    //sys.exit()
                    throw new CASL2_Error(inst.line_number, "", "Label should be defined for START.");
                }
                this.current_scope = inst.label;
                if(this.start_found){
                    //# サブルーチンの実行開始番地が指定されていた場合、gotoに実行開始番地をセットする
                    if(inst.args != null)
                        this.symbols['.'+inst.label].goto = this.conv_adr(inst.args[0]);
                    return null;
                }
                else{
                    this.start_found = true;
                    return new CASL2_ByteCode(this.gen_code_start(inst.op, inst.args), this.addr, inst.line_number, inst.src);
                }
            }
            else if(op_table[inst.op][0] == -101){
                this.current_scope = '';
                return null
            }
            else if(op_table[inst.op][0] < 0){
                return null;
            }

            let bcode = new CASL2_ByteCode(this.gen_code_func[op_table[inst.op][1]].call(this, inst.op, inst.args), this.addr, inst.line_number, inst.src);
            this.addr += bcode.code.length;

            return bcode;
        }
        catch(e){
            throw e;
            //typeerror
            //jscomet.console.error(`Line ${inst.line_number}: Invalid instruction "${inst.op}" was found.`);
            //return; //sys.exit()
            //throw new CASL2_Error(inst.line_number, "", `Invalid instruction "${inst.op}" was found.`);
        }
    }

    is_arg_register(arg){
        if(arg.slice(0,2) == 'GR')
            return true;
        else
            return false;
    }

    /**
     *  @param {CASL2_ByteCode[]} code_list
     *  @returns {number[]}
     */
    outputBin(code_list){
        //number[]
        let ret = [];
        for(let bcode of code_list){
            for(let i of bcode.code){
                ret.push(i);
            }
        }
        return ret;
    }
}
