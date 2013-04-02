var spawn = require('child_process').spawn
  , S = require('string')
  , util = require('util')
  , pty = require('pty.js')

function Suppose(cmd, args, options) {
  this.cmd = cmd
  this.args = args
  this.options = options
  this.expects = []
  this.responses = []
  this.writeStream = null
  this.errorCallback = function(err) { throw err } //default errorCallback
}

Suppose.prototype.debug = function(stream) {
  this.writeStream = stream
  return this
}

Suppose.prototype.error = function(errorCallback) {
  this.errorCallback = errorCallback
  return this
}

Suppose.prototype.on = function(expect) {
  this.expects.push(expect)
  return this
}

Suppose.prototype.respond = function(response) {
  this.responses.push(response)
  return this
}

Suppose.prototype.end = function(callback){
  var exe = pty.spawn(this.cmd, this.args, {
    cwd: this.options || process.cwd(),
    env: this.options || process.env,
    name: 'xterm-color',
    cols: 80,
    rows: 30
  });
  var needNew = true, buffer = '', match = false
  var expect = '', response = ''
  var self = this

  if (self.writeStream) {
    var cmdString = util.format("%s %s", this.cmd, this.args.join(' ')) + "\n"
    self.writeStream.write(cmdString, 'utf8')
    self.writeStream.write(S('-').times(cmdString.length) + "\n")
  }

  exe.stdout.on('data', function(data){
    buffer += data.toString()
    if (self.writeStream) {
      self.writeStream.write(data)
    }

    if (needNew) {
      expect = self.expects.shift()
      response = self.responses.shift()
      needNew = false
    }

    if (typeof expect === 'string')
      match = S(buffer).endsWith(expect)
    else if (typeof expect === 'object')
      match = (buffer.match(expect) != null)

    if (match) {
      needNew = true
      exe.stdin.write(response)
      match = false

      if (self.writeStream) {
        self.writeStream.write(response, 'utf8')
      }
    }
  })

  // temporary hack: pty.js throws an error by default if you try to access stderr
  exe.__defineGetter__('stderr', function () {
    return new (require('stream').Readable)();
  });

  exe.stderr.on('data', function(data) {
    self.errorCallback(new Error(data.toString()))
  })

  exe.on('exit', function(code){
    callback(code)
  })

  return exe;
}


module.exports = function suppose(cmd, args) {
  return new Suppose(cmd, args)
}

