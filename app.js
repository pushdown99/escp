var fs          = require('fs');
var path        = require('path');
var pdf         = require('pdfkit');
var request     = require('request');
var PromiseA    = require('bluebird');
var jimp        = require('jimp');
var npos        = require('npos');
var express     = require('express');
var router      = express.Router();
var app         = express();
let iconv       = require('iconv-lite');
var moment      = require('moment-timezone');
var mysql       = require('mysql');
var rand        = require("random-key");
let ipfsClient  = require('ipfs-http-client');
var ipfs        = ipfsClient('http://127.0.0.1:5001');
var Web3        = require('web3');
let web3        = new Web3('http://34.85.24.36:8545');
var exec        = require('child_process').exec;

var port        = process.env.PORT || 9901;

var escpos      = require('escpos');
escpos.Console  = require('escpos-console');

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.engine('html', require('ejs').renderFile);

app.use(express.json());
app.use(express.urlencoded({ extended: true}));
app.use(express.static(__dirname + '/public'));

var db = mysql.createConnection({
  host     : 'localhost',
  user     : 'sqladmin',
  password : 'admin',
  database : 'escp'
});

db.connect(function(err){
  if(err) {
    console.error("[mysql] Connection (" + err + ")");
    process.exit();
  }
});

db.query("set time_zone='+9:00'", function (err, result) {
  if (err) {
    console.log("[mysql] Timezone (" + err + ")");
    process.exit();
  }
});

function toNumber (s) {
  return parseInt(s.replace(/\,/g, ''), 10);
}

function escpInsert (obj, url, hash) {
  var sql = "INSERT INTO escp (name, owner, register, tel, address, items, ipfs, transaction, block, exvat, vat, total, receive, cash, card, remain, ts) " +
            "values('" + obj.name + "', '" + obj.owner + "', " + "'" + obj.register + "', '" + obj.tel + "', '" + obj.address + "', '" + obj.items + "', '" + url + "', '" + hash +  "', 0, " + toNumber(obj.exvat) + ", " + toNumber(obj.vat) + ", " + toNumber(obj.total) + ", " + toNumber(obj.receive) + ", " + toNumber(obj.cash) + ", 0 , " + toNumber(obj.remain) + ", FROM_UNIXTIME(" + moment(obj.date)/1000 + "))";
  db.query(sql, function (err, result) {
    if (err) console.error("[mysql] Insert (" + err + ") : " + sql);
  });
}

function escpUpdate (transaction, idx, block) {
  var sql = "UPDATE escp SET block = '" + block +"', transactionidx = " + idx + " WHERE transaction = '" + transaction + "'";
  db.query(sql, function (err, result) {
    if (err) console.error("[mysql] Insert (" + err + ") : " + sql);
  });
}

///////////////////////////////////////////////////////////////////////////

function getBlockNumber() {
  return web3.eth.getBlockNumber().then(num => {
    return num;
  });
}

function getBlock(id) {
  return web3.eth.getBlock(id).then(block => {
    return block;
  });
}

function getTransactionFromBlock(block, index) {
  return web3.eth.getTransactionFromBlock(block, index).then(transaction => {
    return transaction;
  });
}


/////////////////////////////////////////////////////////////////////////
//
// middleware
//
app.use(function (req, res, next) {
    req.timestamp  = moment().unix();
    req.receivedAt = moment().tz('Asia/Seoul').format('YYYY-MM-DD HH:mm:ss');
    //console.log(req.receivedAt + ': ', req.method, req.protocol +'://' + req.hostname + req.url);
    return next();
  });

//////////////////////////////////////////////////////////////
//
// Express routing
//
// listener
function checkReceipt(s) {
    console.log(s);
}

function parseReceipt(s, path, hash) {
    exec('/usr/bin/php receipt-parser.php ' + '"' + s + '"', function(err, stdout, stderr) {
        var obj = JSON.parse(stdout);
        console.log(obj);
        escpInsert (obj, path, hash);
    });
}

//////////////////////////////////////////////////////////////////////////////////
// EPSON ESC/P COMMAND

const ESC 	=  27;	// escape code
const RESET 	=  64;
const BOLD 	=  69;
const UNDERLINE =  45;
const ALIGN     =  97;
const POINT     =  77;
const FONTATTR  =  38;
const COLOR     = 114;
const PAPERCUT  =  29;


function escp1(data) {
    const buf = [];
    var idx = 0;

    for(i=0; i<data.length; i++) {
        switch(data[i]) {
        case 27:   
            switch (data[++i]) {
            case 64: 
                //process.stdout.write('<reset>');                  
                break;
            case 69: 
                //process.stdout.write('<bold:' + data[++i] + '>');       // need 1 more     
                i += 1;
                break;
            case 45:
                //process.stdout.write('<underline:' + data[++i] + '>');  // 1/49 on, 0/48 off 
                i += 1;
                break;
            case 97:
                //process.stdout.write('<align:' + data[++i] + '>');      // 0/48 flush left, 1/49 centered, 2/50 flush right, 3/51 fill hustification (flush right and left) 
                i += 1;
                break;
            case 77:
                //process.stdout.write('<point:' + data[++i] + '>');      // 10.5-point, 12-cpi
                i += 1;
                break;
            case 33:
                //process.stdout.write('<font-attr:' + data[++i] + '>');  // 
                i += 1;
                break;
            case 100:
                //process.stdout.write('<lf:' + data[++i] + '>');      // 0 - black, ...
                i += 1;
                break;
            case 105:
                //process.stdout.write('<switch:' + data[++i] + '>');      // 0 - black, ...
                i += 1;
                break;
            case 114:
                //process.stdout.write('<color:' + data[++i] + '>');      // 0 - black, ...
                i += 1;
                break;
            case 29:
                idx = i - 1;
                //process.stdout.write('<paper cut:' + data[++i] + ',' + data[++i] + '>');  
                i += 2;
                break;
            default:
                //process.stdout.write('<unknown:' + data[i] + '>');
                i += 1;
                break;
            }
            break;
        default:
            if(data[i] >= 32) { 
                buf.push(data[i]);
                //process.stdout.write(String.fromCharCode(data[i])); 
            }
            else if(data[i] == 10) {
                buf.push(data[i]);
                //console.log('<lf>');
            }
            else if(data[i] == 13) {
                buf.push(data[i]);
                //console.log('<cr>');
            }
            else if(data[i] == 29) {
                idx = i;
                //console.log('<paper cut:' + data[++i] + ',' + data[++i] + '>');
            }
            else {
                buf.push(data[i]);
                //console.log(data[i]);
            }
        }
   }
   if(idx == 0) idx = data.length - 1;

   checkReceipt(iconv.decode(Buffer.from(buf), 'euc-kr').toUpperCase());

   return  iconv.decode(Buffer.from(buf), 'euc-kr').toUpperCase();

    ////////////////////////////////////////////////////////////////////////////////////
    // not reachable code
    let cut   = Buffer.from([10,10,10,10,10,10,10,10,10,29,86,0,0]);
    let align = Buffer.from([27,92,2,13,10,13]);
    let lfeed = Buffer.from([10]);
    let foot  = Buffer.from('How Many Calories Should You Eat on Average? Stop!!!');

    let txt = Buffer.concat([Buffer.from(data).slice(0, idx), align, foot, lfeed, cut]);
    console.log(Buffer.from(txt).slice(idx, -1));
    
    return Buffer.from(txt).toString('hex');
}

function hexdec(hexString) {
    hexString = (hexString + '').replace(/[^a-f0-9]/gi, '')
    return parseInt(hexString, 16)
}

function hex2bin(hexSource) {
    var bin = '';
    for (var i=0;i<hexSource.length;i=i+2) {
        bin += String.fromCharCode(hexdec(hexSource.substr(i,2)));
    }
    return bin;
}

function remit(path, txt) {
  var from = '0x25199ad920e51f27628e1ee1d8485977923258a0';
  var to   = '0x09204c27bd7104fca1b01304f6d643bdef3272b4';

  web3.eth.personal.unlockAccount(from,'test123', 600)
  .then(resp => {
    console.log('Account unlocked!');
    web3.eth.sendTransaction({
      from: from,
      to: to,
      value: web3.utils.toHex(web3.utils.toWei('1','ether')),
      //gasLimit: web3.utils.toHex(21000),
      //gasPrice: web3.utils.toHex(web3.utils.toWei('10','gwei')),
      data: web3.utils.toHex(path)
    })
    .on('transactionHash', function(hash){
      console.log('transactionHash=',hash);
      parseReceipt(txt, path, hash);
    })
    .on('receipt', function(receipt){
      console.log('receipt=',receipt);
      escpUpdate (receipt.transactionHash, receipt.transactionIndex, receipt.blockNumber);
    })
    //.on('confirmation', function(confirmationNumber, receipt){
    //  console.log('confirmation=',confirmationNumber + ", " + receipt);
    //})
    .on('error', console.error); // If a out of gas error, the second parameter is the receipt.
  });
}

app.post('/', function(req, res) {
    var device  = new escpos.Console();
    var printer = escpos.Printer(device);

    var parser = npos.parser();
    var doc    = new pdf({
        size: [224, 600],
        margins : { // by default, all are 72
            top: 10,
           bottom:10,
            left: 10,
          right: 10
        }
    });
    var filename = 'pdf/' + rand.generate(16) + '.pdf';
    var out = fs.createWriteStream(filename);
    var txt = escp1(Buffer.from(req.body.Data, 'hex'));
    doc.pipe(out);
    doc
      .font('fonts/NanumGothicCoding.ttf')
      .fontSize(9)
      .text(txt, 15, 15);
    doc.end();
    out.on('finish', function() {
      const file = fs.readFileSync(filename);
      ipfs.add(file).then(resp => {
        console.log(resp);
        remit(resp.path, txt);
      });
    });

    device.open(function(error) {
        printer.buffer.write(Buffer.from(req.body.Data, 'hex'));
    });
    res.send(Buffer.from(printer.buffer._buffer).toString('hex'));
});  

app.get('/pdf', function(req, res){
  const file = 'receipt.pdf';;
  res.download(file); // Set disposition and send it.
});

app.get('/ipfs/:hash', function(req, res) {
  require('request').get('http://127.0.0.1:8080/ipfs/' + req.params.hash).pipe(res); 
});


app.get('/', function(req, res){
  res.render('index');
})

app.get('/explorer', function(req, res){
  res.render('explorer', {block: -1, index: -1});
})

app.get('/explorer/:block', function(req, res){
  var block = req.params.block;
  console.log('block', block);
  res.render('explorer', {block: block, index: -1});
})

app.get('/explorer/:block/:index', function(req, res){
  var block = req.params.block;
  var index = req.params.index;
  console.log('block-index', block + ", " + index);
  res.render('explorer', {block: block, index: index});
})


app.get('/json-block/:block', function(req, res){
  var block = req.params.block;
  var maxblock = 200;
  var blocks = [];
  for (i = 0; i < maxblock; i++) {
    getBlock(block - i).then(block => {
      blocks.push(block);
      if(blocks.length >= maxblock) {
        blocks.sort((a,b) => (a.number < b.number ? 1:-1));
        res.send(blocks);
      }
    });
  }
})

app.get('/json-blocks', function(req, res){
  var maxblock = 200;
  var blocks = [];
  getBlockNumber().then(num => {
    for (i = 0; i < maxblock; i++) {
      getBlock(num - i).then(block => {
        blocks.push(block);
        //console.log(block.transactions.length + "=>" + blocks.length);

        if(blocks.length >= maxblock) {
          blocks.sort((a,b) => (a.number < b.number ? 1:-1));
          res.send(blocks);
        }
      });
    }
  });
})

          //console.log("getTransactionFromBlock =>"+JSON.stringify(t));
app.get('/json-transaction', function(req, res){
  var block = req.query.block;
  var index = req.query.index;

  getTransactionFromBlock(block, index).then(transaction => {
    res.send(transaction);
  });
})

app.get('/receipts', function(req, res){
  var sql = "SELECT * FROM escp ORDER BY ts DESC LIMIT 100";
  db.query(sql, function (err, result) {
    if (err) {
      console.error("[mysql] Query (" + err + ")");
      console.error("[mysql] * " + sql);
    }
    else if(result.length > 0) {
      res.send(JSON.stringify(result));
    }
    else res.send("");
  });
})

app.get('/receipts/:id', function(req, res){
  var id = req.params.id;
  var sql = "SELECT * FROM escp WHERE register = '" + id + "' ORDER BY ts DESC";
  db.query(sql, function (err, result) {
    if (err) {
      console.error("[mysql] Query (" + err + ")");
      console.error("[mysql] * " + sql);
    }
    else if(result.length > 0) {
      res.send(JSON.stringify(result));
    }
    else res.send("");
  });
})

app.get('/renter', function(req, res){
  var sql = "SELECT * FROM escp GROUP BY register";
  db.query(sql, function (err, result) {
    if (err) {
      console.error("[mysql] Query (" + err + ")");
      console.error("[mysql] * " + sql);
    }
    else if(result.length > 0) {
      res.send(JSON.stringify(result));
    }
    else res.send("");
  });
})


app.get('/revenue', function(req, res){
  var sql = "SELECT id, register, sum(total), sum(cash), sum(card) FROM escp WHERE DATE_FORMAT(ts, '%Y-%m-%d') = CURDATE() GROUP BY register";
  db.query(sql, function (err, result) {
    if (err) {
      console.error("[mysql] Query (" + err + ")");
      console.error("[mysql] * " + sql);
    }
    else if(result.length > 0) {
      res.send(JSON.stringify(result));
    }
    else res.send("");
  });
})

app.get('/revenue/:id', function(req, res){
  var id = req.params.id;
  var sql = "SELECT id, register, sum(total), sum(cash), sum(card) FROM escp WHERE register = '" + id + "'";
  db.query(sql, function (err, result) {
    if (err) {
      console.error("[mysql] Query (" + err + ")");
      console.error("[mysql] * " + sql);
    }
    else if(result.length > 0) {
      res.send(JSON.stringify(result));
    }
    else res.send("");
  });
})


////////////////////////////////////////////////////////
// listener
app.listen(port, function(){
    console.log('Listener: ', 'Example app listening on port ' + port);
});

module.exports = app;
