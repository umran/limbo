var http = require('http')
var https = require('https')
var url  = require('url')

http.createServer(onRequest).listen(3092)

function onRequest(request, response) {
  var parts = url.parse(request.url)
  var port = 80

  var options = {
    hostname: parts.hostname,
    port: port,
    path: parts.path,
    method: request.method
  }

  var proxy_request = http.request(options, function(proxy_response){
    response.writeHead(proxy_response.statusCode, proxy_response.headers)

    proxy_response.on('data', function(chunk){
      response.write(chunk, 'binary')
    })

    proxy_response.on('end', function(){
      response.end()
    })
  })

  request.on('data', function(chunk){
    proxy_request.write(chunk, 'binary')
  })

  request.on('end', function(){
    proxy_request.end()
  })
}
