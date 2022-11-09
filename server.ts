import * as http from "http";

var fs = require("fs");
var path = require("path");
var mime = require("mime");
var chatServer = require('./lib/chat_server');

var cache = new Map<string, string>() ;

//Возвращает ошибку 404
function send404(res: http.ServerResponse) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.write("Error 404: resourse not found.");
    res.end();
}

//Записывает в заголовок нужный http заголовки, после этого отправляет файл клиенту
function sendFile(res: http.ServerResponse , filePath: string, fileContents: string = '') {
    res.writeHead(200, {
        "content-type": mime.lookup(path.basename(filePath)),
    });
    res.end(fileContents);
}

//Проверяет, есть ли файл в кэше, если нет то читает с диска, иначе выдает ошибку
function serveStatic(res: http.ServerResponse, cache: Map<string, string>, absPath: string) {
    if (cache.get(absPath)) {
        sendFile(res, absPath, cache.get(absPath));
    } else {
        fs.access(absPath, function (err:Error) {
            if (err) {
                send404(res);
            } else {
                fs.readFile(absPath, function (error: Error, data: string) {
                    if (error) {
                        send404(res);
                    } else {
                        cache.set(absPath, data);
                        sendFile(res, absPath, data);
                    }
                });
            }
        });
    }
}

//Создание http сервера 
var server = http.createServer(function(req, res){
    var filePath = '';
    if(req.url == '/'){
        filePath = 'public/index.html';
    } else {
        filePath = 'public' + req.url;
    }
    var absPath = './' + filePath;
    serveStatic(res, cache, absPath);
})

//Запуск сервера
server.listen(3000, function(){
    console.log("Server listening on port 3000.");
});
chatServer.listen(server);