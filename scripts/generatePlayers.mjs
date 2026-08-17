// Gerador do banco de 350 jogadores para o FutLeilão.
// Roda uma vez (node scripts/generatePlayers.mjs) e escreve o JSON final
// em shared/players.json, client/src/data/players.json e server/src/data/players.json.

import { randomUUID } from 'node:crypto';
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const FLAGS = {
  'Brasil': '🇧🇷', 'Argentina': '🇦🇷', 'França': '🇫🇷', 'Alemanha': '🇩🇪',
  'Itália': '🇮🇹', 'Espanha': '🇪🇸', 'Inglaterra': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Portugal': '🇵🇹',
  'Holanda': '🇳🇱', 'Bélgica': '🇧🇪', 'Uruguai': '🇺🇾', 'Croácia': '🇭🇷',
  'Colômbia': '🇨🇴', 'México': '🇲🇽', 'Chile': '🇨🇱', 'Paraguai': '🇵🇾',
  'Suécia': '🇸🇪', 'Dinamarca': '🇩🇰', 'Noruega': '🇳🇴', 'Polônia': '🇵🇱',
  'Ucrânia': '🇺🇦', 'Rússia/URSS': '🇷🇺', 'Hungria': '🇭🇺', 'Bulgária': '🇧🇬',
  'Sérvia': '🇷🇸', 'Escócia': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Irlanda do Norte': '🇬🇧', 'Irlanda': '🇮🇪',
  'País de Gales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'Suíça': '🇨🇭', 'Áustria': '🇦🇹', 'República Tcheca': '🇨🇿',
  'Eslováquia': '🇸🇰', 'Eslovênia': '🇸🇮', 'Romênia': '🇷🇴', 'Camarões': '🇨🇲',
  'Nigéria': '🇳🇬', 'Gana': '🇬🇭', 'Senegal': '🇸🇳', 'Costa do Marfim': '🇨🇮',
  'Marrocos': '🇲🇦', 'Argélia': '🇩🇿', 'Egito': '🇪🇬', 'Libéria': '🇱🇷',
  'Guiné': '🇬🇳', 'Zâmbia': '🇿🇲', 'Japão': '🇯🇵', 'Coreia do Sul': '🇰🇷',
  'Estados Unidos': '🇺🇸', 'Canadá': '🇨🇦', 'Costa Rica': '🇨🇷', 'Jamaica': '🇯🇲',
  'Equador': '🇪🇨', 'Peru': '🇵🇪', 'Bolívia': '🇧🇴', 'Venezuela': '🇻🇪',
  'Geórgia': '🇬🇪', 'Turquia': '🇹🇷', 'Grécia': '🇬🇷', 'Finlândia': '🇫🇮',
  'Islândia': '🇮🇸', 'Austrália': '🇦🇺', 'Cabo Verde': '🇨🇻',
};

// [nome, nacionalidade, era, positionDetail]
const ATACANTES = [
  ['Pelé','Brasil','legend','Centroavante'],['Ronaldo Fenômeno','Brasil','legend','Centroavante'],
  ['Romário','Brasil','legend','Centroavante'],['Careca','Brasil','legend','Centroavante'],
  ['Bebeto','Brasil','legend','Centroavante'],['Gerd Müller','Alemanha','legend','Centroavante'],
  ['Miroslav Klose','Alemanha','legend','Centroavante'],['Jürgen Klinsmann','Alemanha','legend','Centroavante'],
  ['Karl-Heinz Rummenigge','Alemanha','legend','Ponta'],['Marco van Basten','Holanda','legend','Centroavante'],
  ['Dennis Bergkamp','Holanda','legend','Segundo atacante'],['Patrick Kluivert','Holanda','legend','Centroavante'],
  ['Alfredo Di Stéfano','Argentina','legend','Centroavante'],['Ferenc Puskás','Hungria','legend','Centroavante'],
  ['Just Fontaine','França','legend','Centroavante'],['Thierry Henry','França','legend','Ponta'],
  ['David Trezeguet','França','legend','Centroavante'],['Jean-Pierre Papin','França','legend','Centroavante'],
  ['Eusébio','Portugal','legend','Ponta'],['George Best','Irlanda do Norte','legend','Ponta'],
  ['Gabriel Batistuta','Argentina','legend','Centroavante'],['Mario Kempes','Argentina','legend','Centroavante'],
  ['Hernán Crespo','Argentina','legend','Centroavante'],['Diego Milito','Argentina','legend','Centroavante'],
  ['Hristo Stoichkov','Bulgária','legend','Ponta'],['Filippo Inzaghi','Itália','legend','Centroavante'],
  ['Christian Vieri','Itália','legend','Centroavante'],['Alessandro Del Piero','Itália','legend','Segundo atacante'],
  ['Paolo Rossi','Itália','legend','Centroavante'],['Luigi Riva','Itália','legend','Ponta'],
  ['Andriy Shevchenko','Ucrânia','legend','Centroavante'],['Raúl González','Espanha','legend','Centroavante'],
  ['Emilio Butragueño','Espanha','legend','Centroavante'],['Fernando Torres','Espanha','legend','Centroavante'],
  ['David Villa','Espanha','legend','Centroavante'],['Michael Owen','Inglaterra','legend','Centroavante'],
  ['Alan Shearer','Inglaterra','legend','Centroavante'],['Gary Lineker','Inglaterra','legend','Centroavante'],
  ['Wayne Rooney','Inglaterra','legend','Centroavante'],['Samuel Eto\'o','Camarões','legend','Centroavante'],
  ['Didier Drogba','Costa do Marfim','legend','Centroavante'],['George Weah','Libéria','legend','Centroavante'],
  ['Roger Milla','Camarões','legend','Centroavante'],['Zico','Brasil','legend','Segundo atacante'],
  ['Jairzinho','Brasil','legend','Ponta'],['Ademir de Menezes','Brasil','legend','Centroavante'],
  ['Roberto Baggio','Itália','legend','Segundo atacante'],['Marcelo Salas','Chile','legend','Centroavante'],
  ['Iván Zamorano','Chile','legend','Centroavante'],['Faustino Asprilla','Colômbia','legend','Ponta'],
  ['Carlos Valderrama','Colômbia','legend','Ponta'],['Enzo Francescoli','Uruguai','legend','Segundo atacante'],
  ['Ruud Gullit','Holanda','legend','Segundo atacante'],['Preben Elkjær','Dinamarca','legend','Centroavante'],
  ['Kylian Mbappé','França','current','Ponta'],['Erling Haaland','Noruega','current','Centroavante'],
  ['Vinícius Júnior','Brasil','current','Ponta'],['Neymar Jr','Brasil','current','Ponta'],
  ['Harry Kane','Inglaterra','current','Centroavante'],['Mohamed Salah','Egito','current','Ponta'],
  ['Robert Lewandowski','Polônia','current','Centroavante'],['Karim Benzema','França','current','Centroavante'],
  ['Victor Osimhen','Nigéria','current','Centroavante'],['Julián Álvarez','Argentina','current','Centroavante'],
  ['Lautaro Martínez','Argentina','current','Centroavante'],['Darwin Núñez','Uruguai','current','Centroavante'],
  ['Ousmane Dembélé','França','current','Ponta'],['Rafael Leão','Portugal','current','Ponta'],
  ['Khvicha Kvaratskhelia','Geórgia','current','Ponta'],['Bukayo Saka','Inglaterra','current','Ponta'],
  ['Cole Palmer','Inglaterra','current','Segundo atacante'],['Randal Kolo Muani','França','current','Centroavante'],
  ['Marcus Rashford','Inglaterra','current','Ponta'],['Gabriel Jesus','Brasil','current','Centroavante'],
  ['Richarlison','Brasil','current','Centroavante'],['Gonçalo Ramos','Portugal','current','Centroavante'],
  ['Dušan Vlahović','Sérvia','current','Centroavante'],['Alexander Isak','Suécia','current','Centroavante'],
  ['Ivan Toney','Inglaterra','current','Centroavante'],['Serhou Guirassy','Guiné','current','Centroavante'],
  ['Nicolas Jackson','Senegal','current','Centroavante'],['Ollie Watkins','Inglaterra','current','Centroavante'],
  ['Bryan Mbeumo','Camarões','current','Ponta'],['Rodrygo','Brasil','current','Ponta'],
  ['Ansu Fati','Espanha','current','Ponta'],['Bradley Barcola','França','current','Ponta'],
  ['Raphinha','Brasil','current','Ponta'],['Federico Chiesa','Itália','current','Ponta'],
  ['Domenico Berardi','Itália','current','Ponta'],['Marcus Thuram','França','current','Centroavante'],
  ['Lorenzo Insigne','Itália','current','Ponta'],['Timo Werner','Alemanha','current','Centroavante'],
  ['Niclas Füllkrug','Alemanha','current','Centroavante'],['Kingsley Coman','França','current','Ponta'],
  ['Leroy Sané','Alemanha','current','Ponta'],['Jadon Sancho','Inglaterra','current','Ponta'],
  ['Christopher Nkunku','França','current','Segundo atacante'],['Moussa Diaby','França','current','Ponta'],
  ['Wilfried Zaha','Costa do Marfim','current','Ponta'],['Callum Wilson','Inglaterra','current','Centroavante'],
  ['Dominic Solanke','Inglaterra','current','Centroavante'],['Benjamin Šeško','Eslovênia','current','Centroavante'],
];

const MEIAS = [
  ['Diego Maradona','Argentina','legend','Meia armador'],['Zinedine Zidane','França','legend','Meia ofensivo'],
  ['Michel Platini','França','legend','Meia ofensivo'],['Johan Cruyff','Holanda','legend','Meia ofensivo'],
  ['Ronaldinho Gaúcho','Brasil','legend','Meia ofensivo'],['Rivaldo','Brasil','legend','Meia ofensivo'],
  ['Sócrates','Brasil','legend','Meia central'],['Falcão','Brasil','legend','Meia central'],
  ['Gérson','Brasil','legend','Meia armador'],['Kaká','Brasil','legend','Meia ofensivo'],
  ['Andrea Pirlo','Itália','legend','Meia armador'],['Gianni Rivera','Itália','legend','Meia ofensivo'],
  ['Xavi Hernández','Espanha','legend','Meia central'],['Andrés Iniesta','Espanha','legend','Meia ofensivo'],
  ['Luis Figo','Portugal','legend','Ponta/Meia'],['Deco','Portugal','legend','Meia ofensivo'],
  ['Rui Costa','Portugal','legend','Meia ofensivo'],['Steven Gerrard','Inglaterra','legend','Meia central'],
  ['Paul Scholes','Inglaterra','legend','Meia central'],['David Beckham','Inglaterra','legend','Meia direita'],
  ['Frank Lampard','Inglaterra','legend','Meia central'],['Bryan Robson','Inglaterra','legend','Meia central'],
  ['Lothar Matthäus','Alemanha','legend','Meia central'],['Michael Ballack','Alemanha','legend','Meia central'],
  ['Günter Netzer','Alemanha','legend','Meia armador'],['Bastian Schweinsteiger','Alemanha','legend','Meia central'],
  ['Xabi Alonso','Espanha','legend','Volante'],['Sergio Busquets','Espanha','legend','Volante'],
  ['Clarence Seedorf','Holanda','legend','Meia central'],['Edgar Davids','Holanda','legend','Volante'],
  ['Frank Rijkaard','Holanda','legend','Volante'],['Patrick Vieira','França','legend','Volante'],
  ['Didier Deschamps','França','legend','Volante'],['Youri Djorkaeff','França','legend','Meia ofensivo'],
  ['Fernando Redondo','Argentina','legend','Volante'],['Juan Román Riquelme','Argentina','legend','Meia armador'],
  ['Ossie Ardiles','Argentina','legend','Meia central'],['Diego Simeone','Argentina','legend','Volante'],
  ['Marco Tardelli','Itália','legend','Meia central'],['Luka Modrić','Croácia','legend','Meia central'],
  ['Ivan Rakitić','Croácia','legend','Meia central'],['Toni Kroos','Alemanha','legend','Meia central'],
  ['Zico','Brasil','legend','Meia armador'],['Elias Figueroa','Chile','legend','Volante'],
  ['Éver Banega','Argentina','legend','Meia armador'],['Javier Pastore','Argentina','legend','Meia ofensivo'],
  ['Cesc Fàbregas','Espanha','legend','Meia central'],['David Silva','Espanha','legend','Meia ofensivo'],
  ['Yaya Touré','Costa do Marfim','legend','Volante'],['Thiago Alcântara','Espanha','legend','Meia central'],
  ['Casemiro','Brasil','current','Volante'],['Fabinho','Brasil','current','Volante'],
  ['Kevin De Bruyne','Bélgica','current','Meia ofensivo'],['Bruno Fernandes','Portugal','current','Meia ofensivo'],
  ['Bernardo Silva','Portugal','current','Meia central'],['Jude Bellingham','Inglaterra','current','Meia ofensivo'],
  ['Declan Rice','Inglaterra','current','Volante'],['Mason Mount','Inglaterra','current','Meia ofensivo'],
  ['Phil Foden','Inglaterra','current','Meia ofensivo'],['Jamal Musiala','Alemanha','current','Meia ofensivo'],
  ['Florian Wirtz','Alemanha','current','Meia ofensivo'],['Pedri','Espanha','current','Meia central'],
  ['Gavi','Espanha','current','Meia central'],['Fabián Ruiz','Espanha','current','Meia central'],
  ['Rodri','Espanha','current','Volante'],['Federico Valverde','Uruguai','current','Meia central'],
  ['Enzo Fernández','Argentina','current','Volante'],['Rodrigo De Paul','Argentina','current','Meia central'],
  ['Alexis Mac Allister','Argentina','current','Meia central'],['Giovani Lo Celso','Argentina','current','Meia ofensivo'],
  ['Martin Ødegaard','Noruega','current','Meia ofensivo'],['Christian Eriksen','Dinamarca','current','Meia ofensivo'],
  ['Pierre-Emile Højbjerg','Dinamarca','current','Volante'],['N\'Golo Kanté','França','current','Volante'],
  ['Aurélien Tchouaméni','França','current','Volante'],['Eduardo Camavinga','França','current','Volante'],
  ['Antoine Griezmann','França','current','Meia ofensivo'],['Adrien Rabiot','França','current','Meia central'],
  ['Kai Havertz','Alemanha','current','Meia ofensivo'],['Ilkay Gündoğan','Alemanha','current','Meia central'],
  ['Leon Goretzka','Alemanha','current','Meia central'],['Joshua Kimmich','Alemanha','current','Volante'],
  ['Granit Xhaka','Suíça','current','Volante'],['Xherdan Shaqiri','Suíça','current','Meia ofensivo'],
  ['Marco Verratti','Itália','current','Meia central'],['Nicolò Barella','Itália','current','Meia central'],
  ['Sandro Tonali','Itália','current','Volante'],['Frenkie de Jong','Holanda','current','Meia central'],
  ['Georginio Wijnaldum','Holanda','current','Meia central'],['Teun Koopmeiners','Holanda','current','Meia central'],
  ['Dominik Szoboszlai','Hungria','current','Meia ofensivo'],['Moisés Caicedo','Equador','current','Volante'],
  ['Nicolás Domínguez','Argentina','current','Volante'],['James Rodríguez','Colômbia','current','Meia ofensivo'],
  ['Arturo Vidal','Chile','current','Meia central'],['Andrés Guardado','México','current','Meia central'],
  ['Marten de Roon','Holanda','current','Volante'],['Youssouf Fofana','França','current','Volante'],
  ['Manuel Ugarte','Uruguai','current','Volante'],['Ryan Gravenberch','Holanda','current','Meia central'],
  ['Warren Zaïre-Emery','França','current','Meia central'],
];

const DEFENSORES = [
  ['Franz Beckenbauer','Alemanha','legend','Zagueiro'],['Paolo Maldini','Itália','legend','Lateral-esquerdo'],
  ['Franco Baresi','Itália','legend','Zagueiro'],['Fabio Cannavaro','Itália','legend','Zagueiro'],
  ['Cafu','Brasil','legend','Lateral-direito'],['Roberto Carlos','Brasil','legend','Lateral-esquerdo'],
  ['Carlos Alberto Torres','Brasil','legend','Lateral-direito'],['Bobby Moore','Inglaterra','legend','Zagueiro'],
  ['Daniel Passarella','Argentina','legend','Zagueiro'],['Elias Figueroa','Chile','legend','Zagueiro'],
  ['Ronald Koeman','Holanda','legend','Zagueiro'],['Ruud Krol','Holanda','legend','Zagueiro'],
  ['Giacinto Facchetti','Itália','legend','Lateral-esquerdo'],['Claudio Gentile','Itália','legend','Zagueiro'],
  ['Alessandro Nesta','Itália','legend','Zagueiro'],['Lilian Thuram','França','legend','Lateral-direito'],
  ['Marcel Desailly','França','legend','Zagueiro'],['Laurent Blanc','França','legend','Zagueiro'],
  ['Bixente Lizarazu','França','legend','Lateral-esquerdo'],['Carles Puyol','Espanha','legend','Zagueiro'],
  ['Sergio Ramos','Espanha','legend','Zagueiro'],['Gerard Piqué','Espanha','legend','Zagueiro'],
  ['Rio Ferdinand','Inglaterra','legend','Zagueiro'],['John Terry','Inglaterra','legend','Zagueiro'],
  ['Ashley Cole','Inglaterra','legend','Lateral-esquerdo'],['Philipp Lahm','Alemanha','legend','Lateral-direito'],
  ['Matthias Sammer','Alemanha','legend','Zagueiro'],['Jaap Stam','Holanda','legend','Zagueiro'],
  ['Nilton Santos','Brasil','legend','Lateral-esquerdo'],['Djalma Santos','Brasil','legend','Lateral-direito'],
  ['Marcelo','Brasil','legend','Lateral-esquerdo'],['Dani Alves','Brasil','legend','Lateral-direito'],
  ['Thiago Silva','Brasil','legend','Zagueiro'],['David Luiz','Brasil','legend','Zagueiro'],
  ['Aldair','Brasil','legend','Zagueiro'],['Gilberto','Brasil','legend','Lateral-esquerdo'],
  ['Roberto Ayala','Argentina','legend','Zagueiro'],['Oscar Ruggeri','Argentina','legend','Zagueiro'],
  ['José Chamot','Argentina','legend','Zagueiro'],['Néstor Sensini','Argentina','legend','Zagueiro'],
  ['Walter Samuel','Argentina','legend','Zagueiro'],['Javier Zanetti','Argentina','legend','Lateral-direito'],
  ['Gheorghe Hagi','Romênia','legend','Lateral-esquerdo'],['Andoni Goikoetxea','Espanha','legend','Zagueiro'],
  ['Fernando Hierro','Espanha','legend','Zagueiro'],['Míchel Salgado','Espanha','legend','Lateral-direito'],
  ['Roberto Donadoni','Itália','legend','Lateral-esquerdo'],['Gianluca Zambrotta','Itália','legend','Lateral-direito'],
  ['Christian Panucci','Itália','legend','Zagueiro'],['Marcel Petit','França','legend','Zagueiro'],
  ['Silvio Marzolini','Argentina','legend','Lateral-esquerdo'],['Djimi Traoré','Mali','legend','Zagueiro'],
  ['Virgil van Dijk','Holanda','current','Zagueiro'],['Achraf Hakimi','Marrocos','current','Lateral-direito'],
  ['Trent Alexander-Arnold','Inglaterra','current','Lateral-direito'],['Andrew Robertson','Escócia','current','Lateral-esquerdo'],
  ['Kyle Walker','Inglaterra','current','Lateral-direito'],['Reece James','Inglaterra','current','Lateral-direito'],
  ['Ruben Dias','Portugal','current','Zagueiro'],['William Saliba','França','current','Zagueiro'],
  ['Josko Gvardiol','Croácia','current','Zagueiro'],['Antonio Rüdiger','Alemanha','current','Zagueiro'],
  ['Alessandro Bastoni','Itália','current','Zagueiro'],['Theo Hernández','França','current','Lateral-esquerdo'],
  ['Kim Min-jae','Coreia do Sul','current','Zagueiro'],['Éder Militão','Brasil','current','Zagueiro'],
  ['Alphonso Davies','Canadá','current','Lateral-esquerdo'],['Marquinhos','Brasil','current','Zagueiro'],
  ['Milan Škriniar','Eslováquia','current','Zagueiro'],['John Stones','Inglaterra','current','Zagueiro'],
  ['Aymeric Laporte','Espanha','current','Zagueiro'],['Jules Koundé','França','current','Lateral-direito'],
  ['Dayot Upamecano','França','current','Zagueiro'],['Lucas Hernández','França','current','Zagueiro'],
  ['Benjamin Pavard','França','current','Lateral-direito'],['Raphaël Varane','França','current','Zagueiro'],
  ['Pau Cubarsí','Espanha','current','Zagueiro'],['Alejandro Balde','Espanha','current','Lateral-esquerdo'],
  ['Jordi Alba','Espanha','current','Lateral-esquerdo'],['Ben Chilwell','Inglaterra','current','Lateral-esquerdo'],
  ['Marc Cucurella','Espanha','current','Lateral-esquerdo'],['Destiny Udogie','Itália','current','Lateral-esquerdo'],
  ['Pedro Porro','Espanha','current','Lateral-direito'],['Timothy Castagne','Bélgica','current','Lateral-direito'],
  ['Jan Vertonghen','Bélgica','current','Zagueiro'],['Toby Alderweireld','Bélgica','current','Zagueiro'],
  ['Thomas Meunier','Bélgica','current','Lateral-direito'],['Piero Hincapié','Equador','current','Zagueiro'],
  ['Cristian Romero','Argentina','current','Zagueiro'],['Nicolás Otamendi','Argentina','current','Zagueiro'],
  ['Nahuel Molina','Argentina','current','Lateral-direito'],['Lisandro Martínez','Argentina','current','Zagueiro'],
  ['Marcos Acuña','Argentina','current','Lateral-esquerdo'],['Gonzalo Montiel','Argentina','current','Lateral-direito'],
  ['Nico Schlotterbeck','Alemanha','current','Zagueiro'],['Jonathan Tah','Alemanha','current','Zagueiro'],
  ['David Alaba','Áustria','current','Zagueiro'],['Ricardo Rodríguez','Suíça','current','Lateral-esquerdo'],
  ['Manuel Akanji','Suíça','current','Zagueiro'],['Nico Elvedi','Suíça','current','Zagueiro'],
  ['Kalidou Koulibaly','Senegal','current','Zagueiro'],['Presnel Kimpembe','França','current','Zagueiro'],
  ['Clément Lenglet','França','current','Zagueiro'],['Léo Dubois','França','current','Lateral-direito'],
  ['Ferland Mendy','França','current','Lateral-esquerdo'],['Ivan Perišić','Croácia','current','Lateral-esquerdo'],
  ['Joško Vida','Croácia','current','Zagueiro'],['Dominik Livaković','Croácia','current','Zagueiro'],
];

const GOLEIROS = [
  ['Lev Yashin','Rússia/URSS','legend'],['Gordon Banks','Inglaterra','legend'],['Dino Zoff','Itália','legend'],
  ['Peter Shilton','Inglaterra','legend'],['Sepp Maier','Alemanha','legend'],['Oliver Kahn','Alemanha','legend'],
  ['Gianluigi Buffon','Itália','legend'],['Iker Casillas','Espanha','legend'],['Edwin van der Sar','Holanda','legend'],
  ['Petr Čech','República Tcheca','legend'],['José Luis Chilavert','Paraguai','legend'],['Claudio Taffarel','Brasil','legend'],
  ['Rogério Ceni','Brasil','legend'],['René Higuita','Colômbia','legend'],['Fabien Barthez','França','legend'],
  ['David Seaman','Inglaterra','legend'],['Peter Schmeichel','Dinamarca','legend'],['Walter Zenga','Itália','legend'],
  ['Rinat Dasayev','Rússia/URSS','legend'],['Jorge Campos','México','legend'],['Gyula Grosics','Hungria','legend'],
  ['Ricardo Zamora','Espanha','legend'],['Amadeo Carrizo','Argentina','legend'],['Ubaldo Fillol','Argentina','legend'],
  ['Sergio Goycochea','Argentina','legend'],['Nery Pumpido','Argentina','legend'],['Taffarel','Brasil','legend'],
  ['Andoni Zubizarreta','Espanha','legend'],['Bruce Grobbelaar','Zâmbia','legend'],['Pat Jennings','Irlanda do Norte','legend'],
  ['Neville Southall','País de Gales','legend'],
  ['Thibaut Courtois','Bélgica','current'],['Alisson Becker','Brasil','current'],['Ederson','Brasil','current'],
  ['Marc-André ter Stegen','Alemanha','current'],['Manuel Neuer','Alemanha','current'],['Jan Oblak','Eslovênia','current'],
  ['Gianluigi Donnarumma','Itália','current'],['Emiliano Martínez','Argentina','current'],['Yassine Bounou','Marrocos','current'],
  ['Kepa Arrizabalaga','Espanha','current'],['Mike Maignan','França','current'],['David Raya','Espanha','current'],
  ['André Onana','Camarões','current'],['Diogo Costa','Portugal','current'],['Unai Simón','Espanha','current'],
  ['Wojciech Szczęsny','Polônia','current'],['Nick Pope','Inglaterra','current'],['Aaron Ramsdale','Inglaterra','current'],
  ['Robert Sánchez','Espanha','current'],['Bernd Leno','Alemanha','current'],
];

function ratingCurve() {
  // 5% top (95-99), 25% high (85-94), 55% mid (75-84), 15% low (70-74)
  const r = Math.random();
  if (r < 0.05) return 95 + Math.floor(Math.random() * 5);
  if (r < 0.30) return 85 + Math.floor(Math.random() * 10);
  if (r < 0.85) return 75 + Math.floor(Math.random() * 10);
  return 70 + Math.floor(Math.random() * 5);
}

function buildPosition(list, position, targetCount) {
  const pool = list.slice(0, targetCount);
  if (pool.length < targetCount) {
    throw new Error(`${position}: apenas ${pool.length}/${targetCount} nomes disponíveis`);
  }
  return pool.map(([name, nationality, era, positionDetail]) => ({
    id: randomUUID(),
    name,
    nationality,
    nationalityFlag: FLAGS[nationality] ?? '🏳️',
    position,
    positionDetail: positionDetail ?? (position === 'goleiro' ? 'Goleiro' : position),
    rating: ratingCurve(),
    era,
    imageUrl: null,
  }));
}

const players = [
  ...buildPosition(ATACANTES, 'atacante', 100),
  ...buildPosition(MEIAS, 'meia', 100),
  ...buildPosition(DEFENSORES, 'defensor', 100),
  ...buildPosition(GOLEIROS, 'goleiro', 50),
];

// Sort ratings descending within each position purely for readability of the seed file.
players.sort((a, b) => (a.position === b.position ? b.rating - a.rating : a.position.localeCompare(b.position)));

const json = JSON.stringify(players, null, 2);

const targets = [
  path.join(root, 'shared', 'players.json'),
  path.join(root, 'client', 'src', 'data', 'players.json'),
  path.join(root, 'server', 'src', 'data', 'players.json'),
];

for (const target of targets) {
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, json, 'utf-8');
}

console.log(`Gerados ${players.length} jogadores.`);
console.log('atacante:', players.filter(p => p.position === 'atacante').length);
console.log('meia:', players.filter(p => p.position === 'meia').length);
console.log('defensor:', players.filter(p => p.position === 'defensor').length);
console.log('goleiro:', players.filter(p => p.position === 'goleiro').length);
