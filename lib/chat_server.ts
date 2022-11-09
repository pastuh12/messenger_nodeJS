import { Server } from "http";
import * as socketio from "socket.io";

let io: socketio.Server;
let guestNumber = 1;
let nickNames = new Map<string, string>();
let namesUsed: string[] = [];
let currentRoom = new Map<string,string>();

exports.listen = function (server: Server) {
    // Запуск Socket.IO-сервера, чтобы выполняться вместе
    // с существующим HTTP-сервером
    io = new socketio.Server(server)
    // Определение способа обработки каждого пользовательского соединения nickNames, namesUsed);
    // Помещение подключившегося пользователя в комнату Lobby
    io.sockets.on("connection", function (socket: socketio.Socket) {
        guestNumber = assignGuestName(
            socket,
            guestNumber,
            nickNames,
            namesUsed
        );
        joinRoom(socket, "Lobby");
        // Обработка пользовательских сообщений, попыток изменения имени
        // и попыток создания/изменения комнат
        handleMessageBroadcasting(socket, nickNames);
        handleNameChangeAttempts(socket, nickNames, namesUsed);
        handleRoomJoining(socket);
        // Вывод списка занятых комнат по запросу пользователя
        socket.on("rooms", function () {
            socket.emit("rooms", io.sockets._rooms);
        });
        // Определение логики очистки, выполняемой после выхода
        // пользователя из чата
        handleClientDisconnection(socket, nickNames, namesUsed);
    });
};

function assignGuestName(socket: socketio.Socket, guestNumber: number, nickNames: Map<string, string>, namesUsed: string[]) {
    let name = "Guest" + guestNumber;
    nickNames.set(socket.id, name);
    socket.emit("nameResult", {
        success: true,
        name: name,
    });
    namesUsed.push(name);

    return guestNumber + 1;
}

function joinRoom(socket: socketio.Socket, room:string) {
    socket.join(room);
    currentRoom.set(socket.id, room);
    socket.emit("joinResult", {
        room: room,
    });

    socket.broadcast.to(room).emit("message", {
        text: nickNames[socket.id] + " has joined " + room + ".",
    });

    let usersInRoom = await io.in(room).allSockets();
    
    if (usersInRoom.size > 1) {
        let usersInRoomSummary = "User currently in " + room + ":";
        for (let index in usersInRoom) {
            let userSockedId = usersInRoom[index].id;
            if (userSockedId != socket.id) {
                if (index > 0) {
                    usersInRoomSummary += ",";
                }
                usersInRoomSummary += nickNames[userSockedId];
            }
        }
        usersInRoomSummary += ".";

        socket.emit("message", {
            text: usersInRoomSummary,
        });
    }
}

function handleNameChangeAttempts(socket, nickNames, namesUsed) {
    socket.on("nameAttempt", function (name) {
        if (name.indexOf("Guest") == 0) {
            socket.emit("nameResult", {
                success: false,
                messege: 'Names cannot begin with "Guest',
            });
        } else {
            if (namesUsed.indexOf(name) == -1) {
                let previousName = nickNames[socket.id];
                let previousNameIndex = namesUsed.indexOf(previousName);
                namesUsed.push(name);
                nickNames[socket.id] = name;

                delete namesUsed[previousNameIndex];

                socket.emit("nameResult", {
                    success: true,
                    name: name,
                });

                socket.broadcast.to(currentRoom[socket.id]).emit("message", {
                    text: previousName + " is now known as " + name + ".",
                });
            } else {
                socket.emit("nameResult", {
                    success: false,
                    message: "That name is already in use.",
                });
            }
        }
    });
}
