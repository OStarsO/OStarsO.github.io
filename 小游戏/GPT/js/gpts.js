$(".gpt").click(function(){
    let url=$(this).attr("data");
    $("#iframe1").attr("src",url);
    $(".select").removeClass("select");
    $(this).addClass("select");
    localStorage["url"]=url;
});

if(localStorage["url"]){
    let url2=localStorage["url"];
    $(`span[data="${url2}"`).click();
}else{
    $(".select").click();
}

