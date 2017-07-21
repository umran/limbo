var https = require('https')
var http = require('http')
var url  = require('url')
var Iconv  = require('iconv').Iconv

var iso88591ToUtf8 = new Iconv('ISO-8859-1', 'UTF-8')

var urlExpression = /(https:\/\/[\w\d:#@%/;$()~_?\+-=\\\.&]*)/ig
var charExpression = /charset=(.+);|charset=(.+)/i
var htmlUtf8Expression = /utf-8/i
var htmlIso88591Expression = /iso-8859-1/i

var stripped = new Array()

http.createServer(onRequest).listen(3092)

function onRequest(request, response) {

  if(request.method != 'GET') {
    console.log('DROPPING: ' + request.url)
    response.writeHead(404)
    response.end()
    return
  }

  // clean up request headers
  request.headers = cleanReqHeaders(request.headers)

  if(request.url == 'http://detectportal.firefox.com/success.txt') {
    response.end()
    return
  }

  var isSecureLink = false
  var port = 80

  for (i=0; i<stripped.length; i++) {
    if(request.url == stripped[i]) {
      isSecureLink = true
    }
  }

  if(isSecureLink) {
    var port = 443
  }

  var parts = url.parse(request.url)

  var options = {
    hostname: parts.hostname,
    port: port,
    path: parts.path,
    method: 'GET'
  }

  if(isSecureLink) {
    var proxy_request = https.request(options, function(proxy_response){

      console.log('REQUESTING: ' + request.url)
      if(proxy_response.headers['content-type']) {
        console.log('TYPE: ' + proxy_response.headers['content-type'])
      } else {
        console.log('TYPE: undefined')
      }

      var body = ''
      // clean up response headers
      var headers = cleanResHeaders(proxy_response.headers)

      if(headers['content-type']) {
        if(headers['content-type'].indexOf('image') !== -1) {
          // send back clean headers
          response.writeHead(proxy_response.statusCode, headers)
        }
      }

      //proxy_response.setEncoding('utf8')

      proxy_response.addListener('data', function(chunk) {
        if(headers['content-type']) {
          if(headers['content-type'].indexOf('image') !== -1) {
            response.write(chunk, 'binary')
            return
          }

          // append to body if not an image file
          body += chunk
        } else {

            // append to body if content-type is not defined
            body += chunk
        }

      })

      proxy_response.addListener('end', function() {

        if(body) {
          // strip https from all links in body and keeps a registry of stripped urls
          body = cleanBody(body, headers['content-type'])
          console.log('CLEANING BODY: ' + request.url)

          // update content-length in headers
          headers['content-length'] = body.byteLength

          // send clean headers
          response.writeHead(proxy_response.statusCode, headers)

          // write body to client
          response.write(body, 'binary')

        } else if(headers['content-type']) {
          if(headers['content-type'].indexOf('image') == -1) {
            // send clean headers
            response.writeHead(proxy_response.statusCode, headers)
          }
        } else {
          // send clean headers
          response.writeHead(proxy_response.statusCode, headers)
        }

        response.end()

        console.log('SENT: ' + request.url)
      })

    }).on('error', function () {
      console.log('shit happened')
    })
  } else {
    var proxy_request = http.request(options, function (proxy_response) {

      console.log('REQUESTING: ' + request.url)
      if(proxy_response.headers['content-type']) {
        console.log('TYPE: ' + proxy_response.headers['content-type'])
      } else {
        console.log('TYPE: undefined')
      }

      var body = ''
      // clean up response headers
      var headers = cleanResHeaders(proxy_response.headers)

      if(headers['content-type']) {
        if(headers['content-type'].indexOf('image') !== -1) {
          // send back clean headers
          response.writeHead(proxy_response.statusCode, headers)
        }
      }

      //proxy_response.setEncoding('utf8')

      proxy_response.addListener('data', function(chunk) {
        if(headers['content-type']) {
          if(headers['content-type'].indexOf('image') !== -1) {
            response.write(chunk, 'binary')
            return
          }

          // append to body if not an image file
          body += chunk
        } else {
          
            // append to body if content-type is not defined
            body += chunk
        }

      })

      proxy_response.addListener('end', function() {

        if(body) {
          // strip https from all links in body and keeps a registry of stripped urls
          body = cleanBody(body, headers['content-type'])
          console.log('CLEANING BODY: ' + request.url)

          // update content-length in headers
          headers['content-length'] = body.byteLength

          // send clean headers
          response.writeHead(proxy_response.statusCode, headers)

          // write body to client
          response.write(body, 'binary')

        } else if(headers['content-type']) {
          if(headers['content-type'].indexOf('image') == -1) {
            // send clean headers
            response.writeHead(proxy_response.statusCode, headers)
          }
        } else {
          // send clean headers
          response.writeHead(proxy_response.statusCode, headers)
        }

        response.end()

        console.log('SENT: ' + request.url)
      })

    }).on('error', function () {
      console.log('shit happened')
    })
  }

  request.addListener('data', function(chunk) {
    proxy_request.write(chunk, 'binary')
  })
  request.addListener('end', function() {
    proxy_request.end()
  })

}

function cleanReqHeaders(headers) {

  if(headers['accept-encoding']) {
    delete headers['accept-encoding']
  }

  if(headers['if-modified-since']) {
    delete headers['if-modified-since']
  }

  if(headers['cache-control']) {
    delete headers['cache-control']
  }

  return headers
}

function cleanResHeaders(headers) {
  if(headers['content-type']) {
    //console.log(headers['content-type'])
  }

  if(headers['content-encoding']) {
    //console.log(headers['content-encoding'])
  }

  if (headers.location) {
    headers.location = replaceSecureLinks(headers.location)
  }

  return headers
}

function cleanBody(body, type) {
  if(type) {
    var charset = getCharset(type)
  }

  if(!charset || htmlUtf8Expression.test(charset)) {
    var modifiedBody = replaceSecureLinks(body.toString('utf8'))
    return Buffer.from(modifiedBody, 'utf8')
  }

  if(htmlIso88591Expression.test(charset)) {
    var utf8Buf = iso88591ToUtf8.convert(body)
    console.log(utf8Buf.toString('utf8'))
    var modifiedBody = replaceSecureLinks(utf8Buf.toString('utf8'))
    return Buffer.from(modifiedBody, 'utf8')
  }

  console.log('IGNORING PAGE ENCODED WITH: ' + charset)

  return body
}

function replaceSecureLinks(data) {
  var results = data.match(urlExpression)

  if(results) {
    for(i=0; i<results.length; i++) {
      var url = results[i]

      url = url.replace('https://', 'http://')
      //url = url.replace(/&amp;/g, '&')

      stripped.push(url)
    }
  }

  return data.replace(/https:\/\//ig, 'http://')
}

function getCharset(type) {

  var copy = type.replace(/\s/g, '')
  var matches = type.match(charExpression)

  if(!matches) {
    return null
  }

  if(matches[1]) {
    return matches[1]
  } else if(matches[2]) {
    return matches[2]
  }
}
