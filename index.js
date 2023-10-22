const ACTIONS = require('./actions.js');
const PORT = 4040;

const express = require('express')
const app = express()

const http = require('http');
const server = require('http').createServer(app)
const { Server } = require('socket.io');

const io = new Server(server, {
  allowEIO3: true,
  cors: {
    origin: "https://nikko-develop.space",
  },
  path: '/vcs',
});


function getClientRooms() {
  const { rooms } = io.sockets.adapter;
  return Array.from(rooms.keys());
}

setInterval(() => {
  const { rooms } = io.sockets.adapter;
  //console.log(Array.from(rooms.keys()));
}, 1000);

function shareRoomsInfo() {
  io.emit(ACTIONS.SHARE_ROOMS, {
    rooms: getClientRooms(),
  });
}

io.on('connection', (socket) => {
console.log('CONNECTION');
  shareRoomsInfo();

  socket.on(ACTIONS.SHARE_ROOMS, () => {
    shareRoomsInfo();
  });

  socket.on(ACTIONS.JOIN, (config) => {
    const { room: roomID, userID } = config;
    const { rooms: joinedRooms } = socket;

    console.log(userID);

    // is this check really necessary?
    if (Array.from(joinedRooms).includes(roomID)) return console.warn(`Already joined to ${roomID}`);

    const clients = Array.from(io.sockets.adapter.rooms.get(roomID) || []);

    clients.forEach((clientID) => {
      io.to(clientID).emit(ACTIONS.ADD_PEER, {
        peerID: socket.id,
        userID: userID,
        createOffer: false,
      });

      socket.emit(ACTIONS.ADD_PEER, {
        peerID: clientID,
        userID: userID,
        createOffer: true,
      });
    });

    socket.join(roomID);
    shareRoomsInfo();
  });

  socket.on(ACTIONS.LEAVE, () => {
    const { rooms } = socket;

    Array.from(rooms).forEach((roomID) => {
      if (socket.id === roomID) return; // don't leave from myself
      const clients = Array.from(io.sockets.adapter.rooms.get(roomID) || []);
      console.log('room', roomID, ' clients: ', clients);

      clients.forEach((clientID) => {
        io.to(clientID).emit(ACTIONS.REMOVE_PEER, {
          peerID: socket.id,
        });

        socket.emit(ACTIONS.REMOVE_PEER, {
          peerID: clientID,
        });
      });

      socket.leave(roomID);
    });

    shareRoomsInfo();
  });

  socket.on(ACTIONS.RELAY_SDP, ({ peerID, sessionDescription }) => {
    io.to(peerID).emit(ACTIONS.SESSION_DESCRIPTION, {
      peerID: socket.id,
      sessionDescription,
    });
  });

  socket.on(ACTIONS.RELAY_ICE, ({ peerID, iceCandidate }) => {
    io.to(peerID).emit(ACTIONS.ICE_CANDIDATE, {
      peerID: socket.id,
      iceCandidate,
    });
  });

  socket.on(ACTIONS.TOGGLE_VIDEO, (setTo) => {
    socket.broadcast.emit(ACTIONS.TOGGLE_VIDEO, socket.id, setTo);
  });
});

// const publicPath = path.join(__dirname, 'build');

// app.use(express.static(publicPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(publicPath, 'index.html'));
});

server.listen(PORT, () => {
  console.log(`Server Started on port ${PORT}`);
});