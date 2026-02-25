import { Chess } from "chess.js";

const moveText = `
1. e4 e5 2. Nf3 Nc6 3. Bb5 a6 4. Ba4 b5 
( 4... Nf6 5. O-O Nxe4 6. Re1 Nd6 ) 
5. Bb3 Nf6 6. O-O
`;

const chess = new Chess();
chess.loadPgn(moveText);
console.log(chess.fen()); 
