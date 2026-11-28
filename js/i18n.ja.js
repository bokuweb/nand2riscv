// Japanese prose for the JA language setting (see js/i18n.js). Keyed by stage id and string
// key; the English originals are in js/levels.js and js/main.js. Identifiers on screen (part,
// pin and register names, mnemonics, hex) are kept as they are; numbers match the English.
// tools/verify.mjs checks every stage has goal, notes and the same number of hints, the same pins,
// build steps and debugging lines as the English, every part (js/partdocs.js) a description and
// every terminal a line, and every badge a description.

// The pins of every CPU drawing (CPU_PINS in js/levels.js).
const CPU_PINS = {
  inst: 'pc が示すアドレスにあるワードで、図面の外のメモリから来る。pc のビット 1:0 は無視される。クロックを待たず、pc にすぐ追従する。',
  rdata: 'addr が示すアドレスにあるワードで、ビット 1:0 は無視される。メモリはロードかどうかにかかわらず、毎ステップすぐに応答する。',
  reset: '電源投入後の最初のクロックエッジでだけ 1、以後は実行中ずっと 0。PC の reset で、プログラムは 80000000 から始まる。',
  clk: '命令ごとに 1 回、pc、memw、addr、wdata を照合した後で立ち上がる。PC、REGFILE、すべてのレジスタはその立ち上がりエッジで新しい値を取り込む。',
  pc: '実行する命令のアドレス。各ステップの前 (PC = ..., WANT) と、そのクロックエッジの後 (NEXT PC = ..., WANT) にリファレンスと比較される。',
  addr: 'ロードまたはストアのメモリアドレスで、ALU の結果。rdata を決める。memw が 1 のステップでだけ比較される。',
  wdata: 'ストアが書き込むデータで、2 本目のレジスタ。memw が 1 のステップでだけ比較される。',
  memw: 'ストアでは 1、それ以外の命令では 0。毎ステップ照合される。未接続のピンは 0 を読む。',
};

// Fixed shifts SHL1 to SHL16 (js/partdocs.js builds the English the same way).
const shl = (k) => ({
  desc: `${k} ビットの固定左シフト。はみ出したビットは捨て、下に 0 を詰める。配線だけでできている。`,
  pins: { a: '値', out: `a << ${k}` },
});

export const JA = {
  stages: {
    // ---------- 1 LOGIC GATES ----------
    not: {
      goal: '入力を反転する。0 なら 1、1 なら 0。',
      story: '在庫にある部品は NAND だけだ。出力が 0 になるのは両入力が 1 のときだけ。コンピュータのあらゆる回路はこの 1 種類の部品から作れる。',
      hints: ['同じ信号を NAND の両入力に入れる。', '入力ピンから NAND の各入力へドラッグし、NAND の出力から出力ピンへドラッグする。'],
    },
    and: {
      goal: '両入力が 1 のときだけ 1 を出力する。',
      story: 'NAND は NOT AND、つまり結果を反転した AND だ。NOT が在庫に加わった。',
      hints: ['NAND の出力を反転する。', 'NAND の後に NOT。'],
    },
    or: {
      goal: '少なくとも一方の入力が 1 なら 1 を出力する。',
      story: 'ド・モルガンの法則: a OR b は NOT (NOT a AND NOT b) に等しい。',
      hints: ['NAND に入れる前に各入力を反転する。', 'NAND(NOT a, NOT b)。NAND 換算で 3 個。'],
    },
    nor: {
      goal: '両入力が 0 のときだけ 1 を出力する。',
      story: 'NOR は OR の反転だ。NAND と同じく万能で、NOR だけでどんな回路も作れる。',
      hints: ['OR 部品を使う。', 'OR の後に NOT。'],
    },
    xor: {
      goal: '入力が異なるときだけ 1 を出力する。',
      story: 'XOR は加算の核だ。0+0=0、0+1=1、1+0=1、1+1=0 で 1 繰り上がる。和の下位桁が XOR になる。',
      hints: [
        '少なくとも一方が 1、かつ両方ではない。',
        '(a OR b) AND (a NAND b)。評価 B。',
        '評価 A: NAND(a, b) を 1 個だけ作り、その出力を 2 か所で使う。NAND は計 4 個。',
      ],
    },
    xnor: {
      goal: '入力が等しいときだけ 1 を出力する。',
      story: 'XNOR は 1 ビットの一致検出器で、比較器の基本セルだ。',
      hints: ['XOR の反転。', 'XOR の後に NOT。'],
    },

    // ---------- 2 ROUTING ----------
    mux: {
      goal: 'sel が 0 なら a を、1 なら b を出力する。',
      story: 'マルチプレクサは信号で切り替えるスイッチ、つまり if 文のハードウェア版だ。CPU のいたるところに現れる。',
      hints: [
        'sel が 0 で a が 1、または sel が 1 で b が 1。',
        '(a AND NOT sel) OR (b AND sel)。評価 B。',
        '評価 A: AND と OR を NAND に展開し、二重の反転を打ち消す。NAND(NAND(a, NOT sel), NAND(b, sel))。',
      ],
    },
    dmux: {
      goal: 'sel が 0 なら in を a へ、1 なら b へ送る。もう一方の出力は 0。',
      story: 'MUX の逆で、1 本の信号を選んだ宛先へ送る。メモリはこれで書き込むセルを選ぶ。',
      hints: ['a = in AND NOT sel。b = in AND sel。', '評価 A: NAND(in, sel) を 1 個共有する。in AND NOT sel は in AND NAND(in, sel) に等しい。'],
    },
    maj: {
      goal: '3 入力のうち 2 つ以上が 1 なら 1 を出力する。',
      story: '任意の図面。3 入力の多数決で、加算器の桁上げと同じ関数だ。',
      hints: [
        '(a AND b) OR (b AND c) OR (a AND c)。',
        '別解: a と b がともに 1、または a と b が異なり c が 1。',
        '評価 A: NAND 4 個の XOR は NAND(a, b) を含む。それを再利用する。',
      ],
    },

    // ---------- 3 ARITHMETIC ----------
    half: {
      goal: '2 ビットを加算する。sum が下位桁、carry が上位桁。',
      story: '2 進の加算: 0+0=00、0+1=01、1+0=01、1+1=10。出力の各桁は入力のゲート関数 1 つで表せる。',
      hints: ['sum は XOR、carry は AND。', '評価 A: NAND 4 個で XOR を作り、その内部の NAND(a, b) を反転して carry にする。'],
    },
    full: {
      goal: '3 ビット a, b, c を加算する。c は下位桁からの桁上げ。',
      story: '筆算でも下の桁からの桁上げを足す。全加算器を連鎖させれば任意の幅の数を加算できる。',
      hints: [
        '半加算器 2 個: a と b を足し、その結果に c を足す。',
        '2 つの半加算器の carry が同時に 1 になることはない。OR でまとめる。',
        '評価 A: NAND のみ。NAND 4 個の XOR 段を 2 つ、carry 用に NAND 1 個。',
      ],
    },
    add2: {
      goal: '2 ビットの数 a1a0 と b1b0 を加算する。結果は 3 ビットの数 c s1 s0。',
      story: '下位桁を足し、桁上げを上位桁へ渡す。同じ連鎖で 8 ビットにも 64 ビットにも伸ばせる。',
      hints: ['下位桁には桁上げ入力がないので半加算器で足りる。', '上位桁は下位の桁上げも足すので全加算器。その carry が c。'],
    },

    // ---------- 4 MEMORY ----------
    sr: {
      goal: '1 ビットを保持する。s=1 で q を 1 にセット、r=1 で q を 0 にリセットする。両方 0 なら q は値を保つ。',
      story:
        'ゲートの出力を自身の入力に戻すと、回路は記憶する。出力が過去に依存する最初の部品なので、真理値表ではなくステップの列でテストする。ステップをクリックすると、そこまで再生する。',
      hints: [
        '2 つのゲートが、それぞれ相手の入力に出力を返す。',
        'NOR 2 個のたすき掛け: q = NOR(r, nq)、nq = NOR(s, q)。評価 B。',
        '評価 A: NAND 2 個のたすき掛けは負論理の入力でラッチする。先に s と r を反転する。',
      ],
    },
    dlatch: {
      goal: 'en が 1 の間 q は d に従う。en が 0 の間 q は値を保つ。',
      story: 'SR ラッチは制御線が 2 本必要だ。D ラッチはイネーブルの下で 1 本のデータ線を記憶する。イネーブル中は透過になる。',
      hints: [
        'd と en がともに 1 でセット。d が 0 で en が 1 ならリセット。',
        's = d AND en、r = (NOT d) AND en を SR ラッチへ。評価 B。',
        '評価 A: x = NAND(d, en) が負論理のセット、NAND(x, en) が負論理のリセット。さらに NAND 2 個をたすき掛けにする。',
      ],
    },
    dff: {
      goal: 'clk が 0 から 1 に立ち上がる瞬間にだけ d を q へコピーする。それ以外のときは q を保つ。',
      story:
        'ラッチはイネーブルが 1 の間ずっと開いている。フリップフロップはクロックエッジという一瞬だけサンプルする。CPU のレジスタはすべてこれでできており、マシン全体をステップごとに進めるのがクロックだ。',
      hints: [
        'D ラッチ 2 個を直列にし、互いに逆のクロックレベルでイネーブルする。',
        '1 段目は NOT clk で、2 段目は clk でイネーブルする。2 段目が開くちょうどそのとき 1 段目が閉じる。',
      ],
    },
    reg: {
      goal: 'clk の立ち上がりエッジで、load が 1 なら d を格納する。そうでなければ q を保つ。',
      story: 'フリップフロップはクロックのたびに上書きされる。レジスタは指示されたときだけ新しい値を取り込む。RISC-V にはこれが 32 本あり、それぞれ 32 ビット幅だ。',
      hints: ['フリップフロップに格納するものを選ぶ: 新しい d か、自身の q か。', 'MUX(q, d, load) を D 入力へ。q を MUX に戻す。'],
    },
    ram2: {
      goal: '1 ビットのセル 2 個。q は常に addr で選んだセルを示す。clk の立ち上がりエッジで load=1 なら、そのセルに d を書き込む。',
      story: 'メモリはレジスタとアドレス指定でできている。DMUX が書き込み先を振り分け、MUX が読み出しを選ぶ。実際の RAM はアドレスビットが多いだけで同じ構造だ。',
      hints: ['セルごとにレジスタ 1 個。どちらにも同じ d と clk を入れる。', 'DMUX(load, addr) で各レジスタに専用の load を与える。MUX(cell0, cell1, addr) が q を駆動する。'],
    },
    cnt: {
      goal: '2 ビットカウンタ q1 q0。clk の立ち上がりエッジごとに、reset が 1 なら 0 に、そうでなければ 1 を加え、3 の次は 0 に戻る。',
      story: 'これはプログラムカウンタの縮小版だ。CPU は保持しているアドレスの命令をフェッチし、それから先へ進める。',
      hints: [
        'フリップフロップ 2 個が q1 と q0 を保持する。ゲートで現在値から次の値を計算する。',
        'q0 は毎ステップ反転する。q1 は q0 が 1 のとき反転する: 次の q1 = q1 XOR q0。',
        'reset が 1 の間は次の値を両方 0 にする。下位ビットは NOR(reset, q0) の部品 1 個で済む。',
      ],
    },

    // ---------- 5 DATAPATH ----------
    neg: {
      goal: 'a の 2 の補数による符号反転を出力する: out = -a。',
      story:
        'ここから配線は 32 ビットを運ぶ。太い配線はバスで、同じ幅の端子にしかつながらない。NOT32、AND32、OR32、XOR32、MUX32 は作ってきたゲートを 32 個並べたもの。ADD32 は ADD2 の全加算器の連鎖を 32 段にしたもの。バスの入力ピンはクリックするとテスト値を順に切り替える。部品か配線を選ぶとステータスバーにその値が表示される。',
      hints: ['2 の補数: 全ビットを反転し、1 を足す。', 'NOT32 の後に ADD32。もう一方の入力に ZERO32、桁上げ入力に 1。'],
      debug: [
        '表の各行が 1 つのテストベクタで、入力の後に期待される出力が並ぶ。反転表示のセルは、あなたの回路が別の値を出している出力で、その行に NG が付く。',
        '行をクリックすると、その入力が図面に入る。続けて部品か配線を選ぶと、ステータスバーの SEL にその値が 16 進で表示される。部品なら出力ごとに 1 つずつ。',
        'パレットの部品にポインタを合わせるか、図面上の部品を選ぶと、各端子の役割が表示される。下の PARTS ON THIS SHEET に全部の一覧がある。',
      ],
    },
    sub: {
      goal: 'a - b を出力する。',
      story: 'CPU に減算器はない。a - b は a + (-b) であり、+1 は桁上げ入力がただで供給する。',
      hints: ['a + NOT b + 1。', 'b に NOT32 を 1 個、ADD32 を 1 個。桁上げ入力は 1 に固定。'],
    },
    addsub: {
      goal: 'sub が 0 なら a + b を、1 なら a - b を出力する。cout は加算器の桁上げ出力。',
      story: '1 個の加算器で両方をこなす。制御ビットは b の反転と桁上げの供給を同時に行う必要がある。',
      hints: [
        'MUX32 で b と NOT b を選ぶ。評価 B。',
        '1 と XOR すると反転、0 と XOR すると素通し。REP32 は 1 ビットを 32 本すべてに複製する。',
        '評価 A: XOR32(b, REP32(sub)) を加算器へ、sub を桁上げ入力へ。',
      ],
      pins: {
        sub: '0: out = a + b。1: out = a - b で、a + NOT b + 1 として計算する。',
        cout: '加算器のビット 31 からの桁上げで、ADD32 が出すとおりのもの。減算では、借りが出ないとき (符号なしで a >= b) に 1。',
      },
    },
    cmp: {
      goal: 'eq は a と b が等しいとき 1。ltu は符号なしで a < b のとき 1。lt は符号付きで a < b のとき 1。',
      story:
        '分岐命令はどれも、結果を捨てる減算だ。残すのは 3 つの事実だけ: ゼロだったか、借りが出たか、符号は何か。MSB32 はバスの最上位ビットを取り出す。ANY32 はいずれかのビットが立っていれば 1。',
      hints: [
        'a - b を 1 回だけ計算する。eq: 差にどのビットも立っていない。',
        'ltu: a - b が借りを出すのは、加算器の桁上げ出力がちょうど 0 のとき。',
        'lt: 差の符号。減算がオーバーフローしたら反転する。オーバーフロー = (a31 XOR b31) AND (a31 XOR d31)。',
      ],
      pins: {
        ltu: '符号なし: FFFFFFFF が最大の数。',
        lt: '符号付き: ビット 31 が符号なので、FFFFFFFF は -1、80000000 が最小の数。',
      },
    },
    shl: {
      goal: 'a を 5 ビットのシフト量 s4 s3 s2 s1 s0 だけ左シフトする。はみ出したビットは捨て、0 を詰める。',
      story:
        'バレルシフタはループしない。0 から 31 までのどの量も 1、2、4、8、16 の和で表せるので、かけるかどうかを選べる固定シフト 5 段を直列にすれば全部をまかなえる。SHL1 から SHL16 は固定シフトで、配線だけでできている。',
      hints: ['シフト量 1 ビットにつき 1 段: 固定距離だけシフトするか、素通しにする。', 'MUX32(x, SHL1(x), s0)、次に SHL2 と s1 で同様に、SHL16 と s4 まで続ける。'],
      pins: {
        s4: 'シフト量のビット 4: 1 ならさらに 16 シフトする。',
        s3: 'ビット 3: さらに 8。',
        s2: 'ビット 2: さらに 4。',
        s1: 'ビット 1: さらに 2。',
        s0: 'ビット 0: さらに 1。',
      },
    },
    alu: {
      goal: 'RV32I の演算ユニット。f2 f1 f0 で選択: 000 加算 (alt なら減算)、001 左シフト、010 符号付き未満比較、011 符号なし未満比較、100 xor、101 右シフト (alt なら算術)、110 or、111 and。',
      story:
        'これらの選択ビットは RISC-V 命令の funct3 で、alt はビット 30 だ。ALU は全結果を同時に計算し、マルチプレクサのツリーで 1 つを残す。シフタはシフト量を b の下位 5 ビットから取る。ZEXT32 は 1 ビットを 32 ビットの 0 か 1 に広げる。',
      hints: [
        'まず a と b から 8 つの結果をすべて作る。alt は ADDSUB の sub 入力へ。',
        '右シフト: SRL32 と SRA32 を計算し、alt でどちらかを選ぶ。',
        'MUX32 7 個のツリー: 4 個を f0 で、2 個を f1 で、1 個を f2 で選択する。',
      ],
      pins: {
        b: '2 番目のオペランド。シフトはそのビット 4:0 だけをシフト量に使う。',
        f2: 'funct3 のビット 2 で、命令のビット 14。f2 f1 f0 を 3 ビットの数として読み、結果を選ぶ。',
        f1: 'funct3 のビット 1 で、命令のビット 13。',
        f0: 'funct3 のビット 0 で、命令のビット 12。',
        alt: '命令のビット 30。変わるのは 000 (減算) と 101 (算術シフト) だけで、他の 6 つの結果は無視する。',
        out: 'SLT と SLTU は 00000001 か 00000000 を出す。',
      },
    },
    rf4: {
      goal: '32 ビットレジスタ 4 本、x0 から x3。r1 はレジスタ a1a0、r2 はレジスタ b1b0 を示す。clk の立ち上がりエッジで we=1 なら、レジスタ d1d0 に wd を書き込む。x0 は常に 0 を読み出す。',
      story:
        'RISC-V の命令は毎サイクル 2 本のレジスタを読み、1 本に書く。これは RAM 2X1 と同じ構造に読み出しポートを 2 つ付けたものだ。本物のファイルはレジスタ 32 本、アドレス 5 ビットで、この図面に合格すると支給される。',
      hints: [
        'x0 はレジスタではない: ZERO32 を読む。REG32 3 個が x1 から x3 を保持し、どれにも wd と clk を入れる。',
        'd1、次に d0 で DMUX のツリーを組み、we を 1 本のレジスタへ振り分ける。',
        '各読み出しポートは MUX32 3 個: 2 個をアドレスの下位ビットで、1 個を上位ビットで選択する。',
      ],
      pins: {
        wd: '書き込むデータ。',
        we: '書き込みイネーブル: 1 なら clk の立ち上がりエッジで書き込む。x0 への書き込みは何も変えない。',
        d1: '書き込むレジスタの上位ビット。d1 d0 = 11 が x3。',
        d0: '書き込むレジスタの下位ビット。',
        a1: 'r1 に出すレジスタの上位ビット。',
        a0: 'r1 に出すレジスタの下位ビット。',
        b1: 'r2 に出すレジスタの上位ビット。',
        b0: 'r2 に出すレジスタの下位ビット。',
        clk: 'テストは各入力ベクタを clk 0、clk 1 の 2 回与えるので、どのベクタも立ち上がりエッジ 1 回で終わる。',
        r1: '読み出しにクロックは要らない: a1 a0 かレジスタが変わればすぐに r1 も変わる。X はテストが値を問わないことを示す: そのレジスタはまだ書かれていない。',
      },
    },
    pcu: {
      goal: 'clk の立ち上がりエッジごとに: reset が 1 なら pc は 80000000、そうでなく jump が 1 なら target、それ以外は pc + 4 になる。',
      story:
        '命令は 4 バイトなので、分岐やジャンプがなければ次の命令は pc + 4 にある。80000000 は対象マシンで RAM が始まるアドレスで、プログラムが読み込まれる場所でもある。FOUR32 と BASE32 がそれらの定数だ。',
      hints: ['クロックごとに必ず取り込む REG32: load を 1 に固定する。', 'ADD32(pc, FOUR32) が次の値のデフォルト。', 'MUX32 2 個を直列に: jump で target を選び、次に reset で BASE32 を選ぶ。'],
      pins: {
        target: 'jump が 1 のときの行き先アドレス。',
        jump: '1: 次の pc は pc + 4 ではなく target。',
        reset: '1: jump にかかわらず次の pc は 80000000。テストは reset 1 から始まる。',
        clk: '各ベクタは clk 0、次に clk 1 で与えられる: ベクタごとに立ち上がりエッジ 1 回。',
        pc: '最初の reset エッジまでは X: セットされる前のレジスタの中身をテストは問わない。',
      },
    },

    // ---------- 6 RV32I CPU ----------
    immgen: {
      goal: '命令の即値を出力する。デフォルトは I 形式。S、B、U、J の選択線が 1 ならその形式。',
      story:
        'RISC-V 命令は 32 ビットだ。定数は 5 種類のレイアウトで詰め込まれており、符号ビットが常にビット 31 に来て、ほとんどのフィールドが同じ位置に留まるよう選ばれている。IMM-I から IMM-J はそれぞれ 1 つのレイアウトを展開して符号拡張する部品で、配線だけでできている。この図面では命令が使う 1 つを選ぶ。',
      hints: ['5 つすべてを展開してから選ぶ。', 'MUX32 4 個を連鎖させる: I か S、次に B、次に U、次に J。'],
      pins: {
        inst: '命令ワード全体。テストは各形式の命令を 1 つずつ使う。ピンをクリックすると順に切り替わる。',
        s: '1: S 形式。CPU では OPDEC の store。',
        b: '1: B 形式、OPDEC の branch。',
        u: '1: U 形式、LUI か AUIPC。',
        j: '1: J 形式、OPDEC の jal。テストが s b u j のうち 1 にするのは多くても 1 本で、どれも 0 なら答えは I。',
      },
    },
    brc: {
      goal: 'f2 f1 f0 で選んだ分岐条件が成り立つとき taken = 1: 000 等しい、001 等しくない、100 未満、101 以上、110 符号なし未満、111 符号なし以上。',
      story: '比較器はすでに eq、ltu、lt を出している。分岐の funct3 は f2 と f1 でそのうち 1 つを選び、f0 でその否定を求める。',
      hints: ['f1 で lt か ltu を選び、次に f2 でそれか eq を選ぶ。', 'f0 と XOR すると、奇数の funct3 で結果が反転する。'],
      pins: {
        eq: 'CMP32 から: 2 本のレジスタが等しいとき 1。',
        ltu: 'CMP32 から: 1 本目が 2 本目より小さいとき 1、符号なし。',
        lt: 'CMP32 から: 1 本目が 2 本目より小さいとき 1、符号付き。',
        f2: '分岐の funct3 で、命令のビット 14、13、12。010 と 011 は分岐ではなく、テストもされない。',
      },
    },
    cpu1: {
      goal: 'レジスタ間と即値の算術命令を実行する: ADD SUB AND OR XOR SLT SLTU SLL SRL SRA とその即値形式。',
      story:
        'プロセッサは手持ちの部品をループ状につないだものだ。PC がアドレスを出し、メモリがそこの命令を返し、そのフィールドが 2 本のレジスタを選び、ALU がそれらを組み合わせ、結果が書き戻され、PC が進む。テストはプログラムを実行し、命令ごとにあなたのレジスタと PC をリファレンスと比較する。ステップをクリックすると、その命令を図面上で確認できる。メモリは図面の外にある: inst は pc にあるワードだ。下の順番で組み立て、1 ステップごとにトレースを見る: 最初の NG のステップが下へ移っていくはずだ。',
      pins: CPU_PINS,
      steps: [
        'PC。reset ピンを PC の reset に、clk を PC の clk に、PC の pc を pc ピンにつなぐ。target と jump は未接続のままでよい: 未接続の入力は 0 を読むので、PC は 4 ずつ進む。確認: ステップ 0 が THE SHEET NEEDS EXACTLY ONE REGFILE で失敗するようになる。',
        'フィールドとレジスタ。inst を OPDEC、RD、RS1、RS2、FUNCT3、BIT30 につなぐ。REGFILE を 1 個置く: rd は RD から、rs1 は RS1 から、rs2 は RS2 から、clk は clk ピンから、we は 1 から。確認: ステップ 0 が X1 = 00000000, WANT 00000005 で失敗する: まだ意味のある値が書かれていない。',
        'ALU と書き戻し。ALU の a は REGFILE の r1 から、b はひとまず IMM-I から (inst を IMM-I へ)、f2 f1 f0 は FUNCT3 の f2 f1 f0 から、ALU の out を REGFILE の wd へ。確認: ステップ 0 と 1 (ADDI) が通る。ステップ 2 (ADD) は b がまだ即値なので失敗する。',
        'レジスタか即値か。ALU の b の手前に MUX32: a は REGFILE の r2 から、b は IMM-I から、sel は OP-IMM のときだけ 1 になる OPDEC の線から。確認: 最初の NG はステップ 3 の SUB になる: alt がまだ 0 だ。',
        'alt。SUB と SRA はビット 30 が 1、ADD と SRL は 0。OP-IMM ではビット 31:20 が即値なので、ADDI X2, X0, -3 のビット 30 は 1 だが、減算してはいけない。funct3 が 101 のときだけ、それが SRLI と SRAI を区別する。BIT30 を alt に直結するとステップ 1 で失敗する。BIT30、OPDEC の op、FUNCT3 から NOT、AND、OR で alt を作る。確認: 17 ステップすべて OK。',
        'addr、wdata、memw はここでは未接続のままでよい: memw は 0 を読むので、メモリには何も書かれない。使うのは 6-4 から。',
      ],
      debug: [
        'トレースはリファレンスが実行する命令 1 つにつき 1 行で、ステップ番号、PC、命令、OK か NG が並ぶ。その下に最初の NG のステップとその理由が出る。',
        'PC = A, WANT B: そのステップの前のあなたの pc ピン。NEXT PC = A, WANT B: そのクロックエッジの後のあなたの pc。Xn = A, WANT B: クロックエッジの後のレジスタで、あなたの REGFILE から読む。',
        'MEMORY WRITE MISSING か UNEXPECTED MEMORY WRITE: ストアで memw が 0 だったか、ストア以外で 1 だった。WROTE ... AT ..., WANT ... AT ...: ストアの wdata か addr が違う。CIRCUIT DOES NOT SETTLE: レジスタを含まないループが変化し続けている。',
        'トレースの行かリストの行をクリックすると、その命令が図面に入る: 安定した状態で、まだクロックは入っておらず、レジスタはあなたの回路が残したとおり。部品か配線を選ぶと、ステータスバーの SEL でその値が読める。',
        '最初の NG のステップから直す: 状態がリファレンスとずれると、後のステップはそれだけの理由で失敗する。',
      ],
      hints: [
        'PC には今のところ reset と clk だけでよい。RD、RS1、RS2 はレジスタファイルへ、FUNCT3 は ALU へ。',
        'ALU の入力 b: OP なら 2 本目のレジスタ、OP-IMM なら IMM-I。どちらかは OPDEC が示す。',
        'alt はビット 30 をそのまま使ってはいけない: ADDI ではそれは定数の一部だ。alt = BIT30 AND (op OR funct3 が 101)。',
        'funct3 が 101 なのは f2 AND (NOT f1) AND f0 のとき: NOT 1 個と AND 2 個。OPDEC の op との OR 1 個と、BIT30 との AND 1 個で alt ができる。',
        '全配線。inst を OPDEC、RD、RS1、RS2、FUNCT3、BIT30、IMM-I へ。PC: reset、clk。PC の pc を pc ピンへ。REGFILE: wd = ALU の out、we = 1、rd = RD、rs1 = RS1、rs2 = RS2、clk。MUX32: a = REGFILE の r2、b = IMM-I、sel = OPDEC の opimm。ALU: a = REGFILE の r1、b = MUX32 の out、f2 f1 f0 = FUNCT3、alt = BIT30 AND (op OR (f2 AND NOT f1 AND f0))。',
      ],
    },
    cpu2: {
      goal: 'LW と SW を追加する。addr と wdata はメモリへ行き、memw はストアのとき 1、rdata は addr にあるワード。',
      story:
        'どちらも ALU でアドレスを計算する: レジスタ + 即値。だから ALU は funct3 にかかわらず加算しなければならず、ストアの即値は S レイアウトで来て、ストアはレジスタに書き込んではいけない。前の図面の内容が引き継がれている。',
      pins: CPU_PINS,
      steps: [
        'メモリのピン。memw は OPDEC の store から、addr は ALU の out から、wdata は REGFILE の r2 から。確認: ステップ 3 (SW) が書き込むようになるが、アドレスが違う: ALU はまだ funct3 010、つまり SLT に従っている。',
        'ALU に加算させる。ロードとストアは funct3 が何であれ r1 + オフセットが必要だ。FUNCT3 の f2 f1 f0 を、OP か OP-IMM のときだけ通す AND ゲートを経て ALU へ入れる。それ以外の命令はすべて 000、つまり加算になる。alt も同じように 0 に保つ: alt = BIT30 AND (op OR (opimm AND funct3 が 101))。そうしないと funct3 が 101 で負のオフセットのロードが減算してしまう。確認: ステップ 3 は 80000100 ではなく 80000123 に書く: OP-IMM 以外では ALU の b がまだ 2 本目のレジスタだ。',
        '即値のレイアウト。IMM-I を IMMGEN に置き換える: inst は inst から、s は OPDEC の store から。b、u、j は未接続のまま。ALU の b は OP 以外のすべてで即値を取る: MUX32 の sel を NOT op にする。確認: ストアが通る。ステップ 4 (LW) は失敗し、X3 にワードではなくアドレスが入る。',
        'ロードデータ。ALU の out と REGFILE の wd の間に MUX32: a = ALU の out、b = rdata ピン、sel = OPDEC の load。確認: ステップ 6 (SW X3, 260(X2)) が X4 で失敗する: このストアのビット 11:7 は 00100 で、レジスタファイルがそれを rd と受け取った。',
        '書き込みイネーブル。REGFILE の we はストアで 0 でなければならず、次に来る分岐でも 0: we = NOR(store, branch)。確認: 12 ステップすべて OK。',
      ],
      hints: [
        'ロードもストアも ALU で r1 + オフセットを計算する。ALU が加算するには f2 f1 f0 に何が見えていればよいか。',
        'f2 f1 f0 を (op OR opimm) でゲートし、それ以外では ALU が加算するようにする。',
        's 線に store をつないだ IMMGEN。命令が OP でなければ ALU の b は即値を取る。',
        'ロードでは rdata を書き戻す。レジスタの書き込みイネーブル = NOR(store, branch)。',
        '全配線、6-3 からの変更点。u = OR(op, opimm)。ALU の f2 f1 f0 = AND(FUNCT3 の f2, u)、AND(f1, u)、AND(f0, u)。alt = BIT30 AND (op OR (opimm AND f2 AND NOT f1 AND f0))。IMMGEN: inst、s = store。ALU の b の MUX32: a = REGFILE の r2、b = IMMGEN の imm、sel = NOT op。書き戻しの MUX32: a = ALU の out、b = rdata、sel = load。その out を REGFILE の wd へ。REGFILE の we = NOR(store, branch)。memw = store、addr = ALU の out、wdata = REGFILE の r2。',
      ],
    },
    cpu3: {
      goal: 'BEQ BNE BLT BGE BLTU BGEU を追加する。条件が成り立つと、PC は pc + 即値になる。',
      story: '分岐は 2 本のレジスタを比較し、プログラムの行き先を変える。これでループと判断が可能になる。分岐先は分岐命令自身からの相対位置だ。',
      pins: CPU_PINS,
      steps: [
        '条件。CMP32: a = REGFILE の r1、b = REGFILE の r2。BRCOND の eq ltu lt は CMP32 の eq ltu lt から、f2 f1 f0 は FUNCT3 から直接取る。ALU へ行くゲート済みの線は使わない。BRCOND の taken を OPDEC の branch と AND し、PC の jump につなぐ。確認: ステップ 4 (BNE) がジャンプするようになるが、行き先は 00000000: PC の target がまだ未接続だ。',
        '分岐先。OPDEC の branch を IMMGEN の b 線に入れる。ADD32: a = PC の pc、b = IMMGEN の imm、cin = 0。その sum を PC の target へ。確認: 25 ステップすべて OK。',
        'ほかに変えるものはない: 分岐はすでにレジスタにも (6-4 の NOR(store, branch))、メモリにも書かない。',
      ],
      hints: [
        '変わるのは次の pc だけ。PC 部品にはすでに target と jump の入力がある。',
        '2 本のレジスタに CMP32、funct3 で BRCOND、それを OPDEC の branch 線と AND する。',
        'ADD32(pc, 即値) が分岐先。IMMGEN の b 線に branch をつなぐ。',
        '分岐先と taken を PC 部品に入れる。BRCOND には FUNCT3 をゲートせずに入れる: ゲート済みの線は分岐では 000 なので、すべての分岐が BEQ として動いてしまう。',
        '全配線、6-4 からの変更点。CMP32: a = REGFILE の r1、b = REGFILE の r2。BRCOND: eq ltu lt = CMP32 の eq ltu lt、f2 f1 f0 = FUNCT3。taken = AND(OPDEC の branch, BRCOND の taken)。IMMGEN の b = branch。ADD32: a = PC の pc、b = IMMGEN の imm、cin = 0。PC: target = ADD32 の sum、jump = taken。',
      ],
    },
    cpu4: {
      goal: 'JAL、JALR、LUI、AUIPC を追加する。ジャンプは rd に pc + 4 を書く。LUI は即値を書く。AUIPC は pc + 即値を書く。',
      story:
        'JAL と JALR は呼び出しだ: ジャンプして、戻りアドレスをレジスタに残す。LUI と AUIPC は定数やアドレスの上位 20 ビットを作る。この 4 つで、バイトとハーフワードのメモリアクセスを除き、基本整数命令セットが揃う。',
      pins: CPU_PINS,
      steps: [
        '即値。IMMGEN の u = OR(OPDEC の lui, OPDEC の auipc)、IMMGEN の j = OPDEC の jal。これ単独の確認はない: 次のステップで使う。',
        '書き戻し。ロードの MUX32 の後にさらに MUX32 を 3 個連鎖させ、最後を REGFILE の wd へ: JAL か JALR なら pc + 4 (2 個目の ADD32 で作る: a = PC の pc、b = FOUR32、cin = 0)、LUI なら IMMGEN の imm、AUIPC なら pc + 即値 (図面にすでにある分岐先の ADD32 の sum)。確認: ステップ 0 から 2 が通る。ステップ 3 (JAL) は NEXT PC で失敗する。',
        'ジャンプ。PC の jump = taken OR jal OR jalr。PC の target は MUX32: a = 分岐先の ADD32 の sum (JAL の行き先でもある)、b = ALU の out (JALR では r1 + 即値)、sel = OPDEC の jalr。確認: 14 ステップすべて OK。jump だけ直して target をそのままにすると、ステップ 7 (JALR) が NEXT PC で失敗する。',
      ],
      hints: [
        'pc + 即値はすでに図面にある: 分岐先の加算器だ。AUIPC と JAL もそれを使う。',
        'IMMGEN: LUI か AUIPC なら u 線、JAL なら j 線。',
        '分岐が成立するか、命令が JAL か JALR なら PC はジャンプする。JALR は分岐先を ALU から取る。',
        '書き戻しは MUX32 の連鎖: ALU、次にロードなら rdata、ジャンプなら pc + 4、LUI なら即値、AUIPC なら pc + 即値。',
        '全配線、6-5 からの変更点。IMMGEN: u = OR(lui, auipc)、j = jal。ADD32 p4: a = PC の pc、b = FOUR32、cin = 0。jmp = OR(jal, jalr)。MUX32 w2: a = ロードの MUX32 の out、b = p4、sel = jmp。MUX32 w3: a = w2、b = IMMGEN の imm、sel = lui。MUX32 w4: a = w3、b = 分岐の ADD32 の sum、sel = auipc。w4 を REGFILE の wd へ。PC の jump = OR(taken, jmp)。PC の target = MUX32: a = 分岐の ADD32 の sum、b = ALU の out、sel = jalr。',
      ],
    },

    // ---------- 7 HELLO ----------
    hello: {
      goal: 'プログラムを実行する。H E L L O と改行を 1 文字ずつ、アドレス 10000000 の UART に書き込む。',
      story:
        'GOAL 1。新しく作るものはない: あなたのプロセッサが本物のプログラムを実行する。デバイスはただのアドレスだ: 10000000 にワードをストアすると、その下位バイトがシリアルポートから出ていく。1 個の NAND ゲートから、文字を印字するマシンへ。',
      pins: {
        ...CPU_PINS,
        addr: 'ロードまたはストアのメモリアドレスで、ALU の結果。10000000 は UART で、そこへのストアは wdata の下位バイトをシリアルコンソールに出力する。memw が 1 のときだけ比較される。',
      },
      hints: [
        'CPU / JUMP AND UPPER の図面が引き継がれており、そのままで通るはずだ。',
        'ステップが失敗したらクリックする: 選択した配線の値がステータスバーに表示される。',
        'コンソールにはあなたの CPU が送ったものが出る: memw が 1 で addr が 10000000 のステップで、wdata の下位バイトが出力される。SW が UART に届くには、LUI X5 が 10000000 を書かなければならない。',
      ],
    },

    // ---------- 8 RV32I ----------
    ldu: {
      goal: 'rdata (整列したアドレスのワード) からロードが返す値を出力する。f2 f1 f0 は funct3: 000 LB、001 LH、010 LW、100 LBU、101 LHU。addr のビット 1 と 0 がバイトまたはハーフワードを選ぶ。LB と LH はそれを符号拡張し、LBU と LHU はゼロ拡張する。',
      story:
        'メモリはワード単位で応答する。バイトロードはそのバイトを含むワードを取り、バイトをビット 0 まで下ろして 32 ビットに広げ直す。符号付きなら最上位ビットの複製で、符号なしなら 0 で埋める。SHR8 と SHR16 は固定シフト、LOW2 はアドレスのビット 1 と 0 を取り出し、SEXT8 から ZEXT16 は下位 8 または 16 ビットを残して拡張する。どれも配線だけでできている。',
      hints: [
        'まず対象のバイトをビット 0 まで下ろす: アドレスのビット 0 で rdata と SHR8 を MUX32 で選び、次にビット 1 で SHR16 について同様にする。',
        'シフトしたワードから拡張した候補を 4 つ作る: SEXT8、ZEXT8、SEXT16、ZEXT16。f2 で符号付きか符号なしかを選ぶ。',
        'f0 でバイトかハーフワードかを、f1 でシフトしたワード全体を選ぶ。MUX32 は計 6 個。',
      ],
      pins: {
        rdata: 'addr のビット 1:0 を 0 にしたアドレスにある、メモリ上のワード全体。最下位のバイト 0 が、その整列アドレスにあるバイト。',
        addr: 'ロードのバイトアドレス。ここで意味があるのはビット 1 と 0 だけ。',
        f2: 'funct3 のビット 2: 1 ならゼロ拡張 (LBU、LHU)。',
        f1: 'funct3 のビット 1: LW なら 1。',
        f0: 'funct3 のビット 0: ハーフワードなら 1、バイトなら 0。',
      },
    },
    stu: {
      goal: 'f1 f0 はストアの funct3: 00 SB、01 SH、10 SW。wdata は data を「アドレスのビット 1 と 0」の 8 倍だけ左シフトしたもの。mask はワードの 1 バイトにつき 1 ビットで、ビット 0 が最下位バイト。ストアが書き込むバイトごとに 1。',
      story:
        'メモリはデータ線でワード全体を受け取り、どのバイトを置き換えるかをバイトマスクで受け取る。アドレス 3 へのバイトストアは data << 24 をマスク 1000 で、アドレス 2 へのハーフワードストアは data << 16 をマスク 1100 で送る。JOIN4 は単線 4 本を 4 ビットバスにまとめる部品で、配線だけでできている。',
      hints: [
        'wdata はロードユニットの逆: アドレスのビット 0 で SHL8 との MUX32、次にビット 1 で SHL16。',
        'バイト i が書き込まれるのは、ワードストアのとき、アドレスのビット 1 が i のビット 1 と一致するハーフワードストアのとき、両ビットが一致するバイトストアのとき。',
        'mask のビット i = f1 OR (a1 が一致 AND (f0 OR a0 が一致))。評価 A: NAND のみ、入力ごとに NOT 1 個、(f0 OR a0) の項は共有する。',
      ],
      pins: {
        data: 'ストアするレジスタの値。SB はその下位バイトを、SH は下位ハーフワードをストアする。',
        addr: 'ストアのバイトアドレス。ここで意味があるのはビット 1 と 0 だけ。',
        wdata: '全ビットが比較される。マスクが外すバイトも含むので、data 全体をシフトする。',
        mask: '4 ビットで、16 進 1 桁で表示される: 1 は 0001 (バイト 0)、C は 1100 (バイト 3 と 2)、F はワード全体を書く。',
      },
    },
    cpu5: {
      goal: 'LB LH LBU LHU SB SH を追加する。ロードは LOADUNIT を通す。ストアは STOREUNIT で wdata と wmask を駆動し、書き込むかどうかは引き続き memw が示す。プログラムはロードとストアをすべての幅、両方の符号、すべてのバイトレーンで試し、メモリ上の文字列を 1 バイトずつ大文字に変えて出力する: HELLO RV32I。合格すると RUN FIZZBUZZ で、同じ回路がもっと長いプログラム (1 から 100 までの FizzBuzz) を全速で実行する。',
      story:
        'GOAL 2、最後の図面。C の文字列はバイト列で、ワード単位でしか動かせない CPU では、隣の文字を壊さずに 1 文字をストアできない。新しい出力 wmask はストアが書き込むバイトを選び、ビット 0 が最下位。memw がセットされて 0000 ならワード全体を書く。これまでの図面はどれもそうしているので、HELLO の図面を引き継いでもワードストアはそのまま動く。addr は下位 2 ビットを残す: ユニットはそれを使い、メモリは無視する。バイトとハーフワードのアクセスがそろえば、あなたのプロセッサは RV32I の基本命令セット全体を実行する。どの RISC-V プロセッサも実装する命令セットだ: 外したのは ECALL、EBREAK、FENCE だけで、このマシンではどれもすることがない。1 個の NAND ゲートから、本物のプログラムを実行する 32 ビットプロセッサへ: コースはここで終わる。',
      pins: {
        ...CPU_PINS,
        addr: 'ロードまたはストアのメモリアドレスで、ALU の結果の 32 ビットすべて。LOADUNIT と STOREUNIT はビット 1:0 を使い、メモリはそれを無視する。memw が 1 のときだけ比較される。',
        wdata: 'ストアが書き込むデータ。memw が 1 のときだけ、wmask が書き込むバイトについてだけ比較される。',
        wmask: 'ストアが書き込むバイトで、ビット 0 が最下位バイト。memw が 1 で 0000 なら 4 バイトすべてを書く。memw が 1 のとき比較される。',
      },
      steps: [
        'ロード。LOADUNIT: rdata は rdata ピンから、addr は ALU の out から、f2 f1 f0 はゲートしない FUNCT3 の f2 f1 f0 から。ロードの MUX32 の b 入力を rdata ピンから LOADUNIT の out へ付け替える。確認: ロードはすべて通る。最初のバイトストア、ステップ 20 がマスクで失敗する。',
        'ストア。STOREUNIT: data は REGFILE の r2 から、addr は ALU の out から、f1 f0 は FUNCT3 の f1 f0 から。wdata ピンを REGFILE の r2 から STOREUNIT の wdata へ付け替え、STOREUNIT の mask を wmask ピンにつなぐ。memw は OPDEC の store のまま。確認: 165 ステップすべて OK で、コンソールに HELLO RV32I が出る。',
      ],
      hints: [
        'ALU はすでに、funct3 にかかわらずすべてのロードとストアで加算している。',
        'LOADUNIT には rdata、アドレスとして ALU の結果、FUNCT3 を入れる。その出力が書き戻し MUX32 の rdata に置き換わる。',
        'STOREUNIT には 2 本目のレジスタ、アドレス、FUNCT3 の f1 f0 を入れる。その出力が wdata と wmask を駆動する。',
        'LOADUNIT には FUNCT3 の線そのものを入れる。ALU へ行くゲート済みの線はロードではすべて 000 なので、LBU が LB として動いてしまう。',
        '全配線、7-1 からの変更点。LOADUNIT: rdata = rdata ピン、addr = ALU の out、f2 f1 f0 = FUNCT3。ロードの MUX32: a = ALU の out、b = LOADUNIT の out、sel = load。STOREUNIT: data = REGFILE の r2、addr = ALU の out、f1 f0 = FUNCT3 の f1 f0。ピン: wdata = STOREUNIT の wdata、wmask = STOREUNIT の mask、memw = store、addr = ALU の out。',
      ],
    },
  },

  // The part reference (js/partdocs.js), by PARTS key: a description and one line per terminal.
  parts: {
    nand: { desc: 'a と b がともに 1 のときだけ out は 0。', pins: { a: '入力', b: '入力', out: 'NOT (a AND b)' } },
    not: { desc: '入力を反転する。', pins: { in: '入力', out: 'NOT in' } },
    and: { desc: 'a と b がともに 1 のときだけ out は 1。', pins: { a: '入力', b: '入力', out: 'a AND b' } },
    or: { desc: 'a か b が 1 なら out は 1。', pins: { a: '入力', b: '入力', out: 'a OR b' } },
    nor: { desc: 'a と b がともに 0 のときだけ out は 1。', pins: { a: '入力', b: '入力', out: 'NOT (a OR b)' } },
    xor: { desc: 'a と b が異なるとき out は 1。', pins: { a: '入力', b: '入力', out: 'a XOR b' } },
    xnor: { desc: 'a と b が等しいとき out は 1。', pins: { a: '入力', b: '入力', out: 'NOT (a XOR b)' } },
    mux: {
      desc: 'スイッチ: sel が 0 の間 out は a に、1 の間 b に従う。',
      pins: { a: 'sel = 0 のとき通る', b: 'sel = 1 のとき通る', sel: '選択', out: 'a か b' },
    },
    dmux: {
      desc: 'sel が 0 なら in を a へ、1 なら b へ送る。もう一方の出力は 0。',
      pins: { in: 'データ', sel: '選択', a: 'sel = 0 なら in、それ以外は 0', b: 'sel = 1 なら in、それ以外は 0' },
    },
    half: {
      desc: '2 ビットを加算する。',
      pins: { a: '足すビット', b: '足すビット', sum: '下位桁: a XOR b', carry: '上位桁: a AND b' },
    },
    full: {
      desc: '3 ビットを加算する。',
      pins: { a: '足すビット', b: '足すビット', c: '下の桁からの桁上げ入力', sum: 'a + b + c の下位桁', carry: '上位桁: 2 つ以上の入力が 1 なら 1' },
    },
    sr: {
      desc: '1 ビットを保持する。初期値は 0。s と r がともに 1 なら r が優先する。',
      pins: { s: 'セット: 1 で q を 1 にする', r: 'リセット: 1 で q を 0 にする', q: '記憶しているビット。s と r が 0 の間は保持' },
    },
    dlatch: {
      desc: 'en が 1 の間は透過、0 の間は保持する。初期値は 0。',
      pins: { d: 'データ', en: 'イネーブル', q: 'en = 1 の間は d に従い、それ以外は保持' },
    },
    dff: {
      desc: 'clk が 0 から 1 に立ち上がる瞬間に d を取り込み、それ以外のときは保持する。初期値は 0。',
      pins: { d: 'データ。立ち上がりエッジでサンプルされる', clk: 'クロック', q: '記憶しているビット' },
    },
    reg: {
      desc: 'load が 1 のときだけ、clk の立ち上がりエッジで d を取り込むフリップフロップ。初期値は 0。',
      pins: { d: 'データ', load: '1: 立ち上がりエッジで d を格納。0: q を保つ', clk: 'クロック', q: '記憶しているビット' },
    },
    k0: { desc: '定数 0。', pins: { out: '0' } },
    k1: { desc: '定数 1。', pins: { out: '1' } },
    z32: { desc: '定数 00000000。', pins: { out: '00000000' } },
    k4: { desc: '定数 00000004。命令 1 つの大きさ。', pins: { out: '00000004' } },
    kbase: { desc: '定数 80000000。RAM が始まり、プログラムが読み込まれるアドレス。', pins: { out: '80000000' } },
    not32: { desc: '32 本の線それぞれに NOT。', pins: { a: '入力', out: 'ビットごとの NOT a' } },
    and32: { desc: '32 組の線それぞれに AND。', pins: { a: '入力', b: '入力', out: 'ビットごとの a AND b' } },
    or32: { desc: '32 組の線それぞれに OR。', pins: { a: '入力', b: '入力', out: 'ビットごとの a OR b' } },
    xor32: { desc: '32 組の線それぞれに XOR。', pins: { a: '入力', b: '入力', out: 'ビットごとの a XOR b' } },
    mux32: {
      desc: '1 本の選択線で動く MUX を 32 個並べたもの。',
      pins: { a: 'sel = 0 のとき通る', b: 'sel = 1 のとき通る', sel: '選択', out: 'a か b' },
    },
    add32: {
      desc: '32 ビット加算器: 全加算器を 32 段連鎖させたもの。',
      pins: { a: '加数', b: '加数', cin: 'ビット 0 への桁上げ入力: 1 ならさらに 1 を足す', sum: 'a + b + cin の下位 32 ビット', cout: 'ビット 31 からの桁上げ出力' },
    },
    rep32: { desc: '1 本の線をバスの 32 本すべてに複製する。配線だけでできている。', pins: { in: 'ビット', out: 'in = 1 なら FFFFFFFF、それ以外は 00000000' } },
    zext32: { desc: '1 本の線を 32 ビットの数に広げる。配線だけでできている。', pins: { in: 'ビット', out: 'in = 1 なら 00000001、それ以外は 00000000' } },
    msb32: { desc: '符号ビットであるビット 31 を取り出す。配線だけでできている。', pins: { a: '値', out: 'a のビット 31' } },
    any32: { desc: 'a のいずれかのビットが 1 なら out は 1。', pins: { a: '値', out: 'a = 00000000 のときだけ 0' } },
    ...Object.fromEntries([1, 2, 4, 8, 16].map((k) => ['shl' + k, shl(k)])),
    reg32: {
      desc: '32 ビットレジスタ: load が 1 なら clk の立ち上がりエッジで d を取り込む。初期値は 00000000。',
      pins: { d: 'データ', load: '1: 立ち上がりエッジで d を格納。0: q を保つ', clk: 'クロック', q: '記憶している値' },
    },
    addsub: {
      desc: '加算も減算もする 1 個の加算器。',
      pins: { a: '1 番目のオペランド', b: '2 番目のオペランド', sub: '0: a + b。1: a - b', out: '結果の下位 32 ビット', cout: '桁上げ出力。減算では 1 が借りなし (符号なしで a >= b) を示す' },
    },
    cmp: {
      desc: 'a と b を 3 通りに同時に比較する。',
      pins: { a: '1 番目のオペランド', b: '2 番目のオペランド', eq: 'a = b なら 1', ltu: '符号なしの数として a < b なら 1', lt: '符号付きの数として a < b なら 1 (ビット 31 が符号)' },
    },
    sll32: {
      desc: 'a を b のビット 4:0 だけ左シフトする。0 を詰める。',
      pins: { a: '値', b: 'シフト量。使うのはビット 4:0 だけ', out: 'a << b' },
    },
    srl32: {
      desc: 'a を b のビット 4:0 だけ右シフトする。上に 0 を詰める。',
      pins: { a: '値', b: 'シフト量。使うのはビット 4:0 だけ', out: 'a >> b、論理' },
    },
    sra32: {
      desc: 'a を b のビット 4:0 だけ右シフトする。上にビット 31 の複製を詰める。',
      pins: { a: '値', b: 'シフト量。使うのはビット 4:0 だけ', out: 'a >> b、算術' },
    },
    alu: {
      desc: 'RV32I の演算ユニット。8 つの結果をすべて計算し、f2 f1 f0 で 1 つを残す。',
      pins: {
        a: '1 番目のオペランド',
        b: '2 番目のオペランド。シフトはビット 4:0 だけを使う',
        f2: 'funct3 のビット 2 (命令のビット 14)',
        f1: 'funct3 のビット 1 (命令のビット 13)',
        f0: 'funct3 のビット 0 (命令のビット 12)',
        alt: '1: 000 なら減算、101 なら算術右シフト。他では無視される',
        out: '000 a + b (alt なら a - b)、001 a << b、010 符号付きで a < b なら 1、011 符号なしで a < b なら 1、100 a XOR b、101 a >> b (alt なら算術)、110 a OR b、111 a AND b',
      },
    },
    regfile: {
      desc: 'レジスタ x0 から x31 の 32 本: 読み出しポート 2 つと書き込みポート 1 つ。x0 は常に 0 を読む。初期値はすべて 0。CPU のテストはレジスタをこの部品から直接読む。',
      pins: {
        wd: '書き込むデータ',
        we: '書き込みイネーブル: 1 なら clk の立ち上がりエッジで wd をレジスタ rd に書く',
        rd: '書き込むレジスタ、0 から 31。x0 への書き込みは無視される',
        rs1: 'r1 に出すレジスタ',
        rs2: 'r2 に出すレジスタ',
        clk: 'クロック',
        r1: 'レジスタ rs1 の値がすぐに出る: 読み出しにクロックは要らない',
        r2: 'レジスタ rs2 の値がすぐに出る',
      },
    },
    opdec: {
      desc: '命令のビット 6:0、主オペコードを解読する。下の各オペコードで 1 本の出力が 1 になり、それ以外のオペコードではすべて 0。',
      pins: {
        inst: '命令',
        op: 'OP、レジスタ間の算術で 1 (オペコード 0110011)',
        opimm: 'OP-IMM、即値との算術で 1 (0010011)',
        load: 'ロード LB LH LW LBU LHU で 1 (0000011)',
        store: 'ストア SB SH SW で 1 (0100011)',
        branch: 'BEQ BNE BLT BGE BLTU BGEU で 1 (1100011)',
        jal: 'JAL で 1 (1101111)',
        jalr: 'JALR で 1 (1100111)',
        lui: 'LUI で 1 (0110111)',
        auipc: 'AUIPC で 1 (0010111)',
      },
    },
    f_rd: { desc: '命令のビット 11:7、rd フィールドを取り出す。配線だけでできている。', pins: { inst: '命令', rd: '書き込み先レジスタの番号' } },
    f_rs1: { desc: '命令のビット 19:15、rs1 フィールドを取り出す。配線だけでできている。', pins: { inst: '命令', rs1: '1 本目のソースレジスタの番号' } },
    f_rs2: { desc: '命令のビット 24:20、rs2 フィールドを取り出す。配線だけでできている。', pins: { inst: '命令', rs2: '2 本目のソースレジスタの番号' } },
    f_f3: {
      desc: '命令のビット 14:12、funct3 を 3 本の線として取り出す。配線だけでできている。',
      pins: { inst: '命令', f2: 'ビット 14', f1: 'ビット 13', f0: 'ビット 12' },
    },
    f_b30: {
      desc: '命令のビット 30 を取り出す。OP では SUB と SRA を示す。OP-IMM では即値のビット 10 だが、SRAI だけはこれで示される。配線だけでできている。',
      pins: { inst: '命令', out: 'ビット 30' },
    },
    imm_i: {
      desc: 'I 形式の即値: ビット 31:20 を符号拡張したもの。OP-IMM、ロード、JALR。配線だけでできている。',
      pins: { inst: '命令', imm: '即値' },
    },
    imm_s: {
      desc: 'S 形式の即値: ビット 31:25、続いて 11:7 を符号拡張したもの。ストア。配線だけでできている。',
      pins: { inst: '命令', imm: '即値' },
    },
    imm_b: {
      desc: 'B 形式の即値: ビット 31、7、30:25、11:8 と最下位の 0 を符号拡張したもの。分岐。配線だけでできている。',
      pins: { inst: '命令', imm: '即値。常に偶数' },
    },
    imm_u: {
      desc: 'U 形式の即値: ビット 31:12 の下に 0 を 12 個置いたもの。LUI と AUIPC。配線だけでできている。',
      pins: { inst: '命令', imm: '即値' },
    },
    imm_j: {
      desc: 'J 形式の即値: ビット 31、19:12、20、30:21 と最下位の 0 を符号拡張したもの。JAL。配線だけでできている。',
      pins: { inst: '命令', imm: '即値。常に偶数' },
    },
    immgen: {
      desc: '命令形式の即値を選ぶ。どの選択線も 1 でなければ I を出す。複数が 1 なら j、次に u、次に b、次に s が優先する。',
      pins: {
        inst: '命令',
        s: '1: S 形式 (ストア)',
        b: '1: B 形式 (分岐)',
        u: '1: U 形式 (LUI、AUIPC)',
        j: '1: J 形式 (JAL)',
        imm: '32 ビットに符号拡張した即値',
      },
    },
    brcond: {
      desc: '比較器の結果と funct3 から、分岐が成立するかを決める。',
      pins: {
        eq: 'CMP32 の eq',
        ltu: 'CMP32 の ltu',
        lt: 'CMP32 の lt',
        f2: 'funct3 のビット 2: 0 なら eq を、1 なら lt か ltu を見る',
        f1: 'funct3 のビット 1: f2 = 1 のとき、0 なら lt、1 なら ltu',
        f0: 'funct3 のビット 0: 1 なら結果を反転する',
        taken: '分岐するとき 1',
      },
    },
    pc: {
      desc: 'プログラムカウンタ: clk の立ち上がりエッジごとに自分で進む 32 ビットレジスタ。初期値は 00000000。',
      pins: {
        target: 'jump = 1 のときの次のアドレス',
        jump: '1: pc + 4 ではなく target へ行く',
        reset: '1: 80000000 へ行く。jump より優先',
        clk: 'クロック',
        pc: '現在の命令のアドレス',
      },
    },
    shr8: { desc: '8 ビットの固定右シフト。上に 0 を詰める。配線だけでできている。', pins: { a: '値', out: 'a >> 8' } },
    shr16: { desc: '16 ビットの固定右シフト。上に 0 を詰める。配線だけでできている。', pins: { a: '値', out: 'a >> 16' } },
    low2: { desc: 'アドレスのビット 1 と 0 を取り出す。配線だけでできている。', pins: { a: 'アドレス', a1: 'ビット 1', a0: 'ビット 0' } },
    sext8: { desc: 'ビット 7:0 を残し、ビット 31:8 をビット 7 の複製で埋める。配線だけでできている。', pins: { a: '値', out: '下位バイトの符号拡張' } },
    zext8: { desc: 'ビット 7:0 を残し、ビット 31:8 を 0 にする。配線だけでできている。', pins: { a: '値', out: '下位バイトのゼロ拡張' } },
    sext16: { desc: 'ビット 15:0 を残し、ビット 31:16 をビット 15 の複製で埋める。配線だけでできている。', pins: { a: '値', out: '下位ハーフワードの符号拡張' } },
    zext16: { desc: 'ビット 15:0 を残し、ビット 31:16 を 0 にする。配線だけでできている。', pins: { a: '値', out: '下位ハーフワードのゼロ拡張' } },
    join4: {
      desc: '4 本の線を 4 ビットバスにまとめる。配線だけでできている。',
      pins: { b3: 'ビット 3、最上位', b2: 'ビット 2', b1: 'ビット 1', b0: 'ビット 0、最下位', out: 'b3 b2 b1 b0' },
    },
    loadunit: {
      desc: 'ロードが返す値: LOAD UNIT の図面を 1 個の部品にしたもの。',
      pins: {
        rdata: 'そのアドレスに対してメモリが返すワード',
        addr: 'ロードのアドレス。ビット 1 と 0 がバイトかハーフワードを選ぶ',
        f2: 'funct3 のビット 2: 1 ならゼロ拡張 (LBU、LHU)、0 なら符号拡張',
        f1: 'funct3 のビット 1: 1 ならワード全体 (LW)',
        f0: 'funct3 のビット 0: 1 ならハーフワード (LH、LHU)、0 ならバイト (LB、LBU)',
        out: 'rdata を addr のビット 1:0 の 8 倍だけ下ろし、funct3 のとおりに切り出して拡張したもの',
      },
    },
    storeunit: {
      desc: 'ストアのデータをバイトレーンに合わせ、バイトマスクを作る: STORE UNIT の図面を 1 個の部品にしたもの。',
      pins: {
        data: 'ストアする値 (2 本目のレジスタ)',
        addr: 'ストアのアドレス。ビット 1 と 0 がレーンを選ぶ',
        f1: 'funct3 のビット 1: SW なら 1',
        f0: 'funct3 のビット 0: SH なら 1、SB なら 0',
        wdata: 'data を addr のビット 1:0 の 8 倍だけ左シフトしたもの',
        mask: 'ストアが書き込むバイトごとに 1 ビット。ビット 0 が最下位バイト',
      },
    },
  },
  // Qualification descriptions, by badge id.
  badges: {
    first: 'いずれかの図面に合格する。',
    gold: 'NAND 数を削って評価 A に到達する。',
    purist: 'XOR 以降の図面に NAND だけで合格する。',
    fast: '45 秒以内に図面に合格する。',
    nohint: 'ヒントを使わずに 5 つの図面に合格する。',
    over: '評価 B の制限の 2 倍以上の NAND 数で合格する。',
    w1: 'セクション 1 のすべての図面に合格する。',
    w2: 'セクション 2 のすべての図面に合格する。',
    w3: 'セクション 3 のすべての図面に合格する。',
    w4: 'セクション 4 のすべての図面に合格する。',
    w5: 'セクション 5 のすべての図面に合格する。',
    w6: 'セクション 6 のすべての図面に合格する。',
    w7: '自作のプロセッサから HELLO を出力する。',
    w8: '自作の RV32I プロセッサでプログラムを実行する。',
    allgold: 'すべての図面で評価 A に到達する。',
  },

  // Explanatory sentences outside the stages. {name} is filled in by the caller.
  ui: {
    foot: '* は任意の図面。評価 A: NAND 数が制限 A 以内。評価 B: 制限 B 以内。評価 C: 機能が正しい。',
    howto: [
      '部品をクリックするか、図面にドラッグして配置する。',
      '端子から端子へドラッグして配線する。',
      '入力ピンをクリックすると 0 / 1 が切り替わる。',
      '部品か配線を選んで DELETE。CTRL/CMD+Z で元に戻す。',
      'ズームはホイール、ZOOM +/-、+ / - キー、ダブルクリック。0 か FIT で元に戻る。何もない所をドラッグするとパン。',
      'パネル脇の線をドラッグすると幅が変わる。ダブルクリックで元に戻る。',
    ],
    // Panel resize handles (js/panes.js): tooltip and accessible names.
    pane: {
      hint: 'ドラッグで幅を変更。ダブルクリックで元に戻る。',
      left: '仕様パネルの幅',
      right: 'テストパネルの幅',
    },
    erase: ['進捗と保存した図面がすべて削除される。', '元に戻せない。'],
    answer: ['現在の図面は置き換えられる。', '図面をクリアするまで評価は C が上限になる。'],
    note: {
      ref: '模範解答を使用した。評価は C が上限。図面をクリアして描き直せば A か B を取れる。',
      a: '制限 A を満たした。これ以上の削減は不要。',
      b: 'あと NAND {n} 個を減らせば評価 A。',
      c: '評価 B には NAND <= {n} が必要。',
      last: 'これがコース最後の図面だ。',
    },
    // Mismatch reasons that are whole sentences (js/rv32.js), by their English text.
    why: {
      'CIRCUIT DOES NOT SETTLE': '回路が安定しない。',
      'MEMORY WRITE MISSING': 'メモリへの書き込みがない。',
      'UNEXPECTED MEMORY WRITE': '想定外のメモリ書き込みがある。',
      'THE SHEET NEEDS EXACTLY ONE REGFILE': '図面には REGFILE がちょうど 1 個必要。',
      'SERIAL OUTPUT DIFFERS': 'シリアル出力が期待と異なる。',
    },
    // The demo run of the last drawing (RUN FIZZBUZZ).
    demo: {
      idle: '図面上の回路で 1 から 100 までの FizzBuzz を実行し、命令ごとにリファレンスと照合する。得点も評価もない。',
      stopped: 'ステップ {n} で停止した。',
      locked: '先に VERIFY に合格すること: デモは合格した CPU で動く。',
    },
    // SHEET 00 / STATUS at the top of the drawing index (js/dashboard.js).
    dash: {
      start: 'コンピュータの部品はすべて 1 個の NAND ゲートから作る。最初の図面から始めよう。',
      done: 'あなたのプロセッサは 1 個の NAND ゲートから作られ、RV32I の基本命令セットを実行する。もっと長いプログラムを動かしてみよう。',
      below: '評価 A に届いていない図面が {n} 枚ある。',
    },
    // VERIFY stopped by STOP / ESC (stopVerify in js/main.js).
    verify: {
      stopped: 'VERIFY を中止した。採点はしていない。',
    },
  },
};
