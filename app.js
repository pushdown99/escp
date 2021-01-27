const fs          = require('fs');
const path        = require('path');
const pdf         = require('pdfkit');
const request     = require('request');
const PromiseA    = require('bluebird');
const jimp        = require('jimp');
const npos        = require('npos');
const express     = require('express');
const router      = express.Router();
const urlencode   = require('urlencode');
const app         = express();
const iconv       = require('iconv-lite');
const moment      = require('moment-timezone');
const mysql       = require('mysql');
const rand        = require("random-key");
const ipfsClient  = require('ipfs-http-client');
const ipfs        = ipfsClient('http://127.0.0.1:5001');
const Web3        = require('web3');
const web3        = new Web3('http://34.84.103.244:8545');
const exec        = require('child_process').exec;
const dotenv      = require('dotenv').config();
const winston     = require('winston');
const { format: { combine, colorize, timestamp, json }, } = winston;

const port        = process.env.PORT || 9901;

const escpos      = require('escpos');
escpos.Console  = require('escpos-console');

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.engine('html', require('ejs').renderFile);

app.use(express.json());
app.use(express.urlencoded({ extended: true}));
app.use(express.static(__dirname + '/public'));

const db = mysql.createConnection({
  host     : process.env.DB_HOSTNAME,
  user     : process.env.DB_USERNAME,
  password : process.env.DB_PASSWORD,
  database : process.env.DB_DATABASE
});

const logger = winston.createLogger({
  level: "info",
  format: combine(timestamp(), json()),
  transports: [
    new winston.transports.File({ filename: 'escp.log', dirname: path.join(__dirname, "./logs") }),
  ],
});

if (process.env.NODE_ENV !== 'production') { logger.add(new winston.transports.Console()); }
logger.stream = { write: (message) => { logger.info(message); }, };

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
  console.log('s',s);
  if(s == undefined) return 0;
  return parseInt(s.replace(/\,/g, ''), 10);
}

function escpInsert (obj, url, hash) {
  var sql = "INSERT INTO escp (name, owner, register, tel, address, items, ipfs, transaction, block, exvat, vat, total, receive, cash, card, remain, ts) " +
            "values('" + obj.name + "', '" + obj.owner + "', " + "'" + obj.register + "', '" + obj.tel + "', '" + obj.address + "', '" + obj.items + "', '" + url + "', '" + hash +  "', 0, " + toNumber(obj.exvat) + ", " + toNumber(obj.vat) + ", " + toNumber(obj.total) + ", " + toNumber(obj.receive) + ", " + toNumber(obj.cash) + ", " + toNumber(obj.card) + " , " + toNumber(obj.remain) + ", FROM_UNIXTIME(" + moment(obj.date)/1000 + "))";
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
    console.log(num);
    return num;
  });
}

function getBlock(id) {
  return web3.eth.getBlock(id).then(block => {
    console.log(block);
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
    console.log('/usr/bin/php receipt-parser.php ' + '"' + s + '"');
    exec('/usr/bin/php receipt-parser.php ' + '"' + s + '"', function(err, stdout, stderr) {
        var obj = JSON.parse(stdout);
        if(obj != null) {
          logger.info(obj);
          escpInsert (obj, path, hash);
        }
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
      console.log(block);
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
  var sql = "SELECT * FROM escp ORDER BY ts DESC LIMIT 200";
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
  var sql = "SELECT * FROM escp WHERE register = '" + id + "' ORDER BY ts DESC LIMIT 200";
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

app.get('/store/:id', function(req, res){
  var id = req.params.id.toString();
  console.log(id);
  res.render('store', {id: id});
})

app.get('/renter', function(req, res){
  var sql = "SELECT MAX(id) id, name, owner, register, tel, address, max(ts) as ts FROM escp GROUP BY register ORDER BY id";
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

app.get('/renter/:id', function(req, res){
  var id = req.params.id;
  var sql = "SELECT id, name, owner, register, tel, address, max(ts) as ts FROM escp WHERE register = '" + id + "' GROUP BY register";
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
  var id = req.params.id.toString();
  var sql = "SELECT id, register, sum(total) total, sum(cash) cash, sum(card) card FROM escp WHERE register = '" + id + "'";
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

app.get('/revenue-day/:id', function(req, res){
  var id = req.params.id.toString();
  var sql = "SELECT id, register, sum(total) total, sum(cash) cash, sum(card) card FROM escp WHERE DATE(ts) = CURDATE() AND register = '" + id + "'";
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

app.get('/revenue-day/:id/:offset', function(req, res){
  var id = req.params.id.toString();
  var offset = req.params.offset;
  var sql = "SELECT id, register, sum(total) total, sum(cash) cash, sum(card) card FROM escp WHERE DATE(ts) = CURDATE()-" + offset +"  AND register = '" + id + "'";
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

app.get('/revenue-hour/:id/', function(req, res){
  var id = req.params.id.toString();
  var sql = "SELECT a.dt1 as dt, case WHEN b.total is NULL THEN 0 ELSE b.total END as total FROM (SELECT dt + INTERVAL lv-1 HOUR dt1 FROM (SELECT ordinal_position lv, CONCAT(subdate(current_date,0), ' 00') dt FROM information_schema.columns WHERE table_schema = 'mysql' AND table_name = 'user') d WHERE lv < 24) a LEFT OUTER JOIN (SELECT sum(total) total, HOUR(ts) ts FROM escp WHERE register='" + id + "' AND DATE(ts)=CURDATE() GROUP BY HOUR(ts)) b ON HOUR(a.dt1) = b.ts";

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


app.get('/revenue-hour/:id/:offset', function(req, res){
  var id = req.params.id.toString();
  var offset = req.params.offset;
  var sql = "SELECT a.dt1 as dt, case WHEN b.total is NULL THEN 0 ELSE b.total END as total FROM (SELECT dt + INTERVAL lv-1 HOUR dt1 FROM (SELECT ordinal_position lv, CONCAT(subdate(current_date," + offset + "), ' 00') dt FROM information_schema.columns WHERE table_schema = 'mysql' AND table_name = 'user') d WHERE lv <= 24) a LEFT OUTER JOIN (SELECT sum(total) total, HOUR(ts) ts FROM escp WHERE register='" + id + "' AND DATE(ts)=CURDATE()-" + offset + " GROUP BY HOUR(ts)) b ON HOUR(a.dt1) = b.ts";

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

app.get('/revenue-hour-chart/:id/:offset', function(req, res){
  var id = req.params.id.toString();
  var offset = req.params.offset;
  var sql = "SELECT HOUR(a.dt1) as dt, case WHEN b.total is NULL THEN 0 ELSE b.total END as total FROM (SELECT dt + INTERVAL lv-1 HOUR dt1 FROM (SELECT ordinal_position lv, CONCAT(subdate(current_date," + offset + "), ' 00') dt FROM information_schema.columns WHERE table_schema = 'mysql' AND table_name = 'user') d WHERE lv <= 24 AND dt + INTERVAL lv-1 HOUR <= now()) a LEFT OUTER JOIN (SELECT sum(total) total, HOUR(ts) ts FROM escp WHERE register='" + id + "' AND DATE(ts)=CURDATE()-" + offset + " GROUP BY HOUR(ts)) b ON HOUR(a.dt1) = b.ts";

  db.query(sql, function (err, result) {
    if (err) {
      console.error("[mysql] Query (" + err + ")");
      console.error("[mysql] * " + sql);
    }
    else if(result.length > 0) {
      var l = [];
      result.forEach(e => {
        var o = [];
        o.push(e.dt);
        o.push(e.total);
        l.push(o);
      });
      res.send(JSON.stringify(l));
    }
    else res.send("");
  });
})

app.get('/count-hour-chart/:id/:offset', function(req, res){
  var id = req.params.id.toString();
  var offset = req.params.offset;
  var sql = "SELECT HOUR(a.dt1) as dt, case WHEN b.total is NULL THEN 0 ELSE b.total END as total FROM (SELECT dt + INTERVAL lv-1 HOUR dt1 FROM (SELECT ordinal_position lv, CONCAT(subdate(current_date," + offset + "), ' 00') dt FROM information_schema.columns WHERE table_schema = 'mysql' AND table_name = 'user') d WHERE lv <= 24 AND dt + INTERVAL lv-1 HOUR <= now()) a LEFT OUTER JOIN (SELECT count(total) total, HOUR(ts) ts FROM escp WHERE register='" + id + "' AND DATE(ts)=CURDATE()-" + offset + " GROUP BY HOUR(ts)) b ON HOUR(a.dt1) = b.ts";

  db.query(sql, function (err, result) {
    if (err) {
      console.error("[mysql] Query (" + err + ")");
      console.error("[mysql] * " + sql);
    }
    else if(result.length > 0) {
      var l = [];
      result.forEach(e => {
        var o = [];
        o.push(e.dt);
        o.push(e.total);
        l.push(o);
      });
      res.send(JSON.stringify(l));
    }
    else res.send("");
  });
})

app.get('/revenue-day-chart/:id/:days', function(req, res){
  var id = req.params.id.toString();
  var days = req.params.days;
  var sql = "SELECT DATE_FORMAT(a.dt1,'%m/%d') as dt, case WHEN b.total is NULL THEN 0 ELSE b.total END as total FROM (SELECT dt + INTERVAL lv-1 DAY dt1 FROM (SELECT ordinal_position lv, CONCAT(subdate(current_date," + (days-1) + "), '') dt FROM information_schema.columns WHERE table_schema = 'mysql' AND table_name = 'user') d WHERE lv <= " + days + ") a LEFT OUTER JOIN (SELECT sum(total) total, DAY(ts) ts FROM escp WHERE register='" + id + "' GROUP BY DAY(ts)) b ON DAY(a.dt1) = b.ts";

  db.query(sql, function (err, result) {
    if (err) {
      console.error("[mysql] Query (" + err + ")");
      console.error("[mysql] * " + sql);
    }
    else if(result.length > 0) {
      var l = [];
      result.forEach(e => {
        var o = [];
        o.push(e.dt);
        o.push(e.total);
        l.push(o);
      });
      res.send(JSON.stringify(l));
    }
    else res.send("");
  });
})

app.get('/revenue-month-chart/:id/:months', function(req, res){
  var id = req.params.id.toString();
  var months = req.params.months;
  var sql = "SELECT DAY(a.dt1) as dt, case WHEN b.total is NULL THEN 0 ELSE b.total END as total FROM (SELECT dt + INTERVAL lv-1 DAY dt1 FROM (SELECT ordinal_position lv, CONCAT(DATE_FORMAT(subdate(current_date(), INTERVAL " + months + " MONTH),'%Y%m'), '01') dt FROM information_schema.columns WHERE table_schema = 'mysql' AND table_name = 'user') d WHERE lv <= DAY(LAST_DAY(dt)) AND dt + INTERVAL lv-1 DAY <= current_date()) a LEFT OUTER JOIN (SELECT sum(total) total, MONTH(ts) month, DAY(ts) day FROM escp WHERE register='" + id + "' GROUP BY DAY(ts)) b ON MONTH(a.dt1) = b.month AND DAY(a.dt1) = b.day";

  db.query(sql, function (err, result) {
    if (err) {
      console.error("[mysql] Query (" + err + ")");
      console.error("[mysql] * " + sql);
    }
    else if(result.length > 0) {
      var l = [];
      var t = 0;
      result.forEach(e => {
        var o = [];
        t += e.total;
        o.push(e.dt);
        o.push(t);
        l.push(o);
      });
      res.send(JSON.stringify(l));
    }
    else res.send("");
  });
})

app.get('/geocode/:addr', function(req, res){
  var addr = urlencode(req.params.addr);
  console.log('https://maps.googleapis.com/maps/api/geocode/json?address='+addr+'&key='+process.env.GOOGLE_API_KEY);
  request('https://maps.googleapis.com/maps/api/geocode/json?address='+addr+'&key='+process.env.GOOGLE_API_KEY, function (error, response, body) {  
    res.send(body);
  });
});

app.get('/summary-renters', function(req, res){
  var sql = "SELECT IFNULL(COUNT(c.name),0) total FROM (SELECT name FROM escp GROUP BY name) c"
  db.query(sql, function (err, result) {
    if (err) {
      console.error("[mysql] Query (" + err + ")");
      console.error("[mysql] * " + sql);
    }
    else if(result.length > 0) {
      var l = [];
      result.forEach(e => {
        var o = [];
        o.push(e.total);
        l.push(o);
      });
      res.send(JSON.stringify(l));
    }
    else res.send("");
  });
});

app.get('/summary-sales', function(req, res){
  var sql = "SELECT FORMAT(IFNULL(sum(c.total),0),0) total FROM( SELECT register, sum(total) total FROM escp WHERE DATE_FORMAT(ts, '%Y-%m-%d') = ADDDATE(CURDATE(),0) GROUP BY register) c";
  db.query(sql, function (err, result) {
    if (err) {
      console.error("[mysql] Query (" + err + ")");
      console.error("[mysql] * " + sql);
    }
    else if(result.length > 0) {
      var l = [];
      result.forEach(e => {
        var o = [];
        o.push(e.total);
        l.push(o);
      });
      res.send(JSON.stringify(l));
    }
    else res.send("");
  });
});

app.get('/summary-users', function(req, res){
  var sql = "SELECT IFNULL(count(*),0) total FROM  escp  WHERE DATE_FORMAT(ts, '%Y-%m-%d') = ADDDATE(CURDATE(),0)";
  db.query(sql, function (err, result) {
    if (err) {
      console.error("[mysql] Query (" + err + ")");
      console.error("[mysql] * " + sql);
    }
    else if(result.length > 0) {
      var l = [];
      result.forEach(e => {
        var o = [];
        o.push(e.total);
        l.push(o);
      });
      res.send(JSON.stringify(l));
    }
    else res.send("");
  });
});

app.get('/summary-month-sales', function(req, res){
  var sql = "SELECT FORMAT(IFNULL(sum(c.total),0),0) total FROM( SELECT register, sum(total) total FROM escp WHERE DATE_FORMAT(ts, '%Y-%m') = DATE_FORMAT(ADDDATE(CURDATE(),0), '%Y-%m') GROUP BY register) c";
  db.query(sql, function (err, result) {
    if (err) {
      console.error("[mysql] Query (" + err + ")");
      console.error("[mysql] * " + sql);
    }
    else if(result.length > 0) {
      var l = [];
      result.forEach(e => {
        var o = [];
        o.push(e.total);
        l.push(o);
      });
      res.send(JSON.stringify(l));
    }
    else res.send("");
  });
});

app.get('/summary-renters/:id', function(req, res){
  var id = req.params.id.toString();
  var sql = "SELECT IFNULL(COUNT(c.name),0) total FROM (SELECT name FROM escp GROUP BY name) c"
  db.query(sql, function (err, result) {
    if (err) {
      console.error("[mysql] Query (" + err + ")");
      console.error("[mysql] * " + sql);
    }
    else if(result.length > 0) {
      var l = [];
      result.forEach(e => {
        var o = [];
        o.push(e.total);
        l.push(o);
      });
      res.send(JSON.stringify(l));
    }
    else res.send("");
  });
});

app.get('/summary-sales/:id', function(req, res){
  var id = req.params.id.toString();
  var sql = "SELECT FORMAT(IFNULL(sum(c.total),0),0) total FROM( SELECT register, sum(total) total FROM escp WHERE DATE_FORMAT(ts, '%Y-%m-%d') = ADDDATE(CURDATE(),0) AND register = '" + id + "' GROUP BY register) c";
  db.query(sql, function (err, result) {
    if (err) {
      console.error("[mysql] Query (" + err + ")");
      console.error("[mysql] * " + sql);
    }
    else if(result.length > 0) {
      var l = [];
      result.forEach(e => {
        var o = [];
        o.push(e.total);
        l.push(o);
      });
      res.send(JSON.stringify(l));
    }
    else res.send("");
  });
});

app.get('/summary-users/:id', function(req, res){
  var id = req.params.id.toString();
  var sql = "SELECT IFNULL(count(*),0) total FROM  escp  WHERE DATE_FORMAT(ts, '%Y-%m-%d') = ADDDATE(CURDATE(),0) AND register = '" + id + "'";
  db.query(sql, function (err, result) {
    if (err) {
      console.error("[mysql] Query (" + err + ")");
      console.error("[mysql] * " + sql);
    }
    else if(result.length > 0) {
      var l = [];
      result.forEach(e => {
        var o = [];
        o.push(e.total);
        l.push(o);
      });
      res.send(JSON.stringify(l));
    }
    else res.send("");
  });
});

app.get('/summary-month-sales/:id', function(req, res){
  var id = req.params.id.toString();
  var sql = "SELECT FORMAT(IFNULL(sum(c.total),0),0) total FROM( SELECT register, sum(total) total FROM escp WHERE DATE_FORMAT(ts, '%Y-%m') = DATE_FORMAT(ADDDATE(CURDATE(),0), '%Y-%m') AND register = '" + id + "' GROUP BY register) c";
  db.query(sql, function (err, result) {
    if (err) {
      console.error("[mysql] Query (" + err + ")");
      console.error("[mysql] * " + sql);
    }
    else if(result.length > 0) {
      var l = [];
      result.forEach(e => {
        var o = [];
        o.push(e.total);
        l.push(o);
      });
      res.send(JSON.stringify(l));
    }
    else res.send("");
  });
});


app.get('/linux-dash', function(req, res){
  res.render('linux-dash');
});

app.get('/logs', function(req, res){
  res.render('kibana');
});

app.get('/about', function(req, res){
  res.render('about');
});

////////////////////////////////////////////////////////
// listener
app.listen(port, function(){
    console.log('Listener: ', 'Example app listening on port ' + port);
});

module.exports = app;
