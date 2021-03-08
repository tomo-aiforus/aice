/**
 * ライブラリ読み込み
 */
const vueSeamless = window.vueSeamlessScroll;

/**
 * *************************************************************************
 * ルームメンバーを管理するVue
 */
var memberVue = new Vue({
  el: "#memberapp",

  data: {
    members: [
      /*
      {
        user_id: "uid",
        user_name: "name1",
        timestamp: "1111111111"
      }
      */
    ],
  },

  computed: {
    loginmembers: function () {
      var viewList = [];

      var date = new Date();
      var a = date.getTime();
      var nowtime = Math.floor(a / 1000);

      for (var i in this.members) {
        var member = this.members[i];

        if (Number(member.timestamp) > nowtime - 10) {
          viewList.push(member);
        }
      }
      return viewList;
    },
  },

  methods: {
    updateMemberList: function (msg) {
      var text = msg;
      const words = text.split("---");
      const user_name = words[0];
      const user_id = words[1];

      var date = new Date();
      var a = date.getTime();
      var nowtime = Math.floor(a / 1000);
      var exist_count = 0;

      // 一致するものがあったらtimestampを更新
      this.members.forEach((member, index) => {
        if (member.user_id === user_id) {
          this.$set(this.members[index], "timestamp", nowtime);
          exist_count++;
        }
      });

      // 新規メンバーならmemberに追加
      if (exist_count == 0) {
        const new_member = {
          user_id: user_id,
          user_name: user_name,
          timestamp: nowtime,
        };
        this.members.push(new_member);
      }
    },

    unsableUser: function (msg) {
      var text = msg;
      const words = text.split("---");
      const user_name = words[0];
      const user_id = words[1];

      // 一致するものがあったらtimestampを0にする
      this.members.forEach((member, index) => {
        if (member.user_id === user_id) {
          this.$set(this.members[index], "timestamp", 0);
          exist_count++;
        }
      });
    },

    vote: function (data) {
      //var data = JSON.parse(voteJson);
      var target_id;
      if (data.vote === "good") {
        target_id = "user_good_" + data.id;
        $("#vote_se").get(0).play();
      } else {
        target_id = "user_bad_" + data.id;
      }
      $("#" + target_id).removeClass("hidden");
      $("#" + target_id)
        .delay(20000)
        .queue(function () {
          $(this).addClass("hidden").dequeue();
        });
    },
  },
});

/**
 * *************************************************************************
 * チャットのコンテンツを制御するVue
 */
var chatVue = new Vue({
  el: "#chatapp",

  data: {
    contents: [
      {
        // id: 1,
        // text: "ルームに参加しました。左下のカメラボタンでスタートしてください。"
      },
    ],
  },

  computed: {
    loginmembers: function () {
      var viewList = [];

      var date = new Date();
      var a = date.getTime();
      var nowtime = Math.floor(a / 1000);

      for (var i in this.members) {
        var member = this.members[i];

        if (Number(member.timestamp) > nowtime - 10) {
          viewList.push(member);
        }
      }
      return viewList;
    },
  },

  methods: {
    // チャットメッセージを受信したら呼ばれる
    addContent: function (msg) {
      var date = new Date();
      var a = date.getTime();
      var nowtime = Math.floor(a / 1000);
      var newMessage = {
        id: nowtime,
        text: msg,
      };
      this.contents.push(newMessage);
      // this.scrollBottom();

      var $this = this;
      Vue.nextTick(function () {
        $this.scrollToEnd();
      });
    },
    addContent2: function (content) {
      // できればdataとconputedViewは分けたいところだけど、
      // 混乱するので今の時点では編集してしまうことにしました。

      var data = JSON.parse(content);
      const text = data.user_name + " : " + data.message;
      var date = new Date();
      var a = date.getTime();
      var nowtime = Math.floor(a / 1000);
      var newMessage = {
        id: nowtime,
        text: text,
        chat_color: data.chat_color,
      };
      this.contents.push(newMessage);
      // this.scrollBottom();

      var $this = this;
      Vue.nextTick(function () {
        $this.scrollToEnd();
      });
    },
    scrollToEnd: function () {
      var container = document.getElementById("chatscrollarea");
      container.scrollTop = container.scrollHeight;
    },
  },
});

/**
 * *************************************************************************
 * ビデオ表示をを制御するVue
 * まずは数を数えてクラスの制御をするだけ
 */
var videoVue = new Vue({
  el: "#videoapp",

  data: {
    vCount: 1,
  },

  computed: {
  },

  methods: {
    // 表示されているビデオ数を管理
    addVideoCount: function () {
      this.vCount++;
    },
    removeVideoCount: function () {
      this.vCount--;
    },
    setPresenClass() {
      console.log("setPresenClass");
      $(".videowrapper").each((index, elm) => {
        $(elm).removeClass("vc1 vc2 vc3 vc4 vc5 vc6 vc7");
        $(elm).addClass("vc4");
      });
    },
    editVideoClass: function () {
      $(".videowrapper").each((index, elm) => {
        $(elm).removeClass("vc1 vc2 vc3 vc4 vc5 vc6 vc7");
        $(elm).addClass(this.getClassname);
      });
    },
    getClassname: function () {
      var classname = "";
      switch (this.vCount) {
        case 1:
          classname = "vc1";
          break;
        case 2:
          classname = "vc2";
          break;
        case 3:
          classname = "vc3";
          break;
        case 4:
          classname = "vc4";
          break;
        case 5:
          classname = "vc5";
          break;
        case 6:
          classname = "vc6";
          break;
        default:
          // 7以上は同じ
          classname = "vc7";
          break;
      }
      return classname;
    },
  },
});
