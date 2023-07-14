var responses = {

	0: [ 0, "我需要一个 %password% 不是这个怪物。",
		 "真的，你打电话 %that!% 密码？",
	     "你甚至知道密码是什么吗 %is!?%",
	     "糟糕。密码。 %Ever.%" ],

	1: [ 0, "我不是 %angry%, 只是失望。",
	     "努力 %bub%",
	     "这很漂亮 %pathetic%",
	     "真 %poor% 努力。" ],

	2: [ 0, "愿如来佛祖有 %mercy% 在您的电子邮件帐户上。",
	     "别来 %crying% 当你被黑客入侵时给我。",
	     "我 %hope% 此帐户并不重要。",
	     "此密码需要更多 %emoji%." ],

	3: [ 0, "蹒跚学步 %eat% 像您这样的早餐密码",
	     "捣碎你的 %head% 在键盘上会更安全",
	     "你拿这个吗 %seriously%?",
	     "你是 %joking% 右？" ],

	4: [ 0, "我见过 %dogs% 使用更好的密码。",
	     "也许这很好 10 %years% 前。",
	     "我 %worry% 关于你。",
	     "你缺乏 %creativity%."],

	5: [ 0, "Oh... you're going to use %that% huh?",
	     "%Weak%. Just weak.",
	     "Sorry %chump%, this just won't do.",
	     "You're %half% way there, I'd say."
	     ],

	6: [ 0, "我 %almost% 就像你要去哪里一样。",
	     "%Close%, 但没有雪茄。",
	     "也许我应该 %just do it%.",
	     "你是 %starting% 去理解。"],

	7: [ 0, "你是 %getting% 那里。。。有点。",
	     "温暖，你得到了 %warmer%.",
	     "我会 %almost% 使用这个。",
	     "我会给你一个 A %effort%." ],

	8: [ 0, "不大 %shabby%, 对于一个3岁的孩子。",
	     "如此接近。我是 %mean% 因为我在乎。",
	     "%Fair%, 但不是你最好的作品。",
	     "%Who% 给你写的？" ],

	9: [ 0, "它非常强大...我 %guess%.",
	     "我认识你 %could% 最终到达那里。",
	     "是的，就像你要去 %remember% 这。",
	     "那就行了 %pig%, 那就行了。" ]

}

var passiveText = document.querySelector( '.passive-agressive');
var $passiveText = $( passiveText );
var passwordElement = $( '.password' );
var headerElement = $( 'header' );

function applyResponse( complexity ) {

	// Get item
	var level = ( Math.ceil( complexity / 10) - 1 );

	if ( level == -1 ) {
		return;
	}

	var textSelection = responses[ level ];
	var textItem = textSelection[ 1 + textSelection[0] ];
	
	// Increment item
	textSelection[ 0 ] += 1;
	textSelection[ 0 ] %= (textSelection.length - 1);

	$passiveText.css( { opacity: 0, "margin-top": "-20px" } );
	// Apply, and set title.
	textItems = textItem.split('%');
	passiveText.innerHTML = textItems[0] + "<span class='red'>" + textItems[1] + '</span>' + textItems[2];

	$passiveText.stop().animate( {opacity: 1, "margin-top": 0}, 450, 'swing' );
}

$( "input" ).complexify( {}, function(valid, complexity){
    applyResponse( complexity );
});

$( '.password input' ).focus( function() {
	passwordElement.addClass( "focused" );
})

$( '.password input' ).blur( function() {
	passwordElement.removeClass( "focused" );	
})

$( '.about' ).click( function() {
	headerElement.addClass( "open" );
	$("html, body").animate({ scrollTop: 0 }, 100);
})

headerElement.mouseout( function() {
	headerElement.removeClass( "open" );
})
