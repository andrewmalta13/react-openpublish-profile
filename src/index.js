var React = require('react');
var xhr = require('xhr');

var Post = require('./post.js');
var Comment = require('./comment.js');
var IDPicture = require('./id-picture.js');
var getBitstoreBalance = require('./bitstore.js');

var Row = require('react-bootstrap/lib/Row');
var Col = require('react-bootstrap/lib/Col');
var Nav = require('react-bootstrap/lib/Nav');
var Panel = require('react-bootstrap/lib/Panel');
var Button = require('react-bootstrap/lib/Button');
var NavItem = require('react-bootstrap/lib/NavItem');
var Glyphicon = require('react-bootstrap/lib/Glyphicon');

var tipToComment = require('tip-to-comment-client');
var commonBlockchain = require('blockcypher-unofficial');
var testCommonWallet = require('test-common-wallet');

function postTime(datetime) {
  var oneDay = 24*60*60*1000;
  var oneHour = 60*60*1000;
  var oneMinute = 60*1000;
  var firstDate = new Date();
  var secondDate = new Date(datetime);
  var timezoneOffset = firstDate.getTimezoneOffset() * 60 * 1000;
  var diffDays = Math.round(Math.abs(((firstDate.getTime() + timezoneOffset)- secondDate.getTime())/(oneDay)));
  var diffHours = Math.round(Math.abs(((firstDate.getTime() + timezoneOffset) - secondDate.getTime())/(oneHour)));
  var diffMinutes = Math.round(Math.abs(((firstDate.getTime() + timezoneOffset) - secondDate.getTime())/(oneMinute)));
  if (diffDays > 1) return "" + diffDays + " days ago";
  else if (diffHours === 0 && diffMinutes === 1) return "published " + diffMinutes + " minute ago";
  else if (diffHours === 0) return "" + diffMinutes + " minutes ago";
  else if (diffHours === 1) return "" + diffHours + " hour ago";
  else return "" + diffHours + " hours ago";
}

var Profile = React.createClass({
  getInitialState: function() {
    var commonWallet = testCommonWallet({
      commonBlockchain: commonBlockchain({ network: this.props.network, inBrowser: true }),
      network: this.props.network,
      wif: this.props.wif
    });
    var tipToCommentClient = tipToComment({
      inBrowser: true,
      commonWallet: commonWallet
    });
    this.balance();
    return {
      getProfileData: true,
      balance: "Loading...",
      bitstore_balance: "Loading...",
      blockchain: null,
      ttcClient: tipToCommentClient,
      wallet: commonWallet
    }
  },

  componentDidMount: function () {
    var BASE = 'http://coinvote-testnet.herokuapp.com';
    if (this.props.network === undefined) console.log('No network parameter is specified, defaulting to testnet.');
    if (this.props.network === 'mainnet') BASE = 'http://coinvote.herokuapp.com';

    var userPosts;
    var userTips;
    var userComments;
    var queryCount = 0;
    var queryGoal = 3;
     
    var that = this;
    this.posts(BASE, function (posts) {
      userPosts = posts;
      if (++queryCount === queryGoal) {
        that.renderProfile(userPosts, userComments, userTips);
      }
    });
    this.tips(BASE, function (tips) {
      userTips = tips;
      if (++queryCount === queryGoal) {
        that.renderProfile(userPosts, userComments, userTips);
      }
    });
    this.comments(function (comments) {
      userComments = comments;
      if (++queryCount === queryGoal) {
        that.renderProfile(userPosts, userComments, userTips);
      }
    }); 
  },

  balance: function () {
    var BASE = 'http://coinvote-testnet.herokuapp.com';
    if (this.props.network === undefined) console.log('No network parameter is specified, defaulting to testnet.');
    if (this.props.network === 'mainnet') BASE = 'http://coinvote.herokuapp.com';
    var that = this;
    xhr({
      uri: BASE + '/getBalance/' + this.props.address,
      headers: {
          "Content-Type": "application/json"
      },
      method: 'GET'
    }, function (err, resp, body) {
      if (err) {
        console.log("error retrieving balance from server");
      }
      else {
        var parsed = JSON.parse(body);
        var balance = parsed.balance / 100000000;
        getBitstoreBalance(that.props.wif, that.props.network, function (error, bitstoreBalance) {
          that.setState({
            base: BASE,
            balance: balance,
            bitstore_balance: bitstoreBalance.body.balance / 100000000,
            updateBalance: false
          });
        });   
      }
    });
  },

  posts: function (base, callback) {
    xhr({
      uri: base + '/getPosts/user?address=' + this.props.address,
      headers: {
        "Content-Type": "application/json"
      },
      method: 'GET'
    }, function (err, resp, body) {
      console.log("Received response from server");
      if (!err) {
        var posts = JSON.parse(body).posts;
        callback(posts);
      }
    });
  },

  tips: function (base, callback) {
    var that = this;
     xhr({
      uri: base + '/getTips?user=' + this.props.address,    
      method: 'GET'
    }, function (err, resp, body) {
      if (err) console.log("error fetching comments from server: " + err);
      else {
        callback(JSON.parse(body).tips);
      }
    });
  },

  comments: function (callback) {
    var that = this;
    this.state.ttcClient.getComments({
      method: "address",
      query: this.props.address
    }, function (err, resp) {
      if (err) {
        console.log(err);
      }
      else {
        callback(resp);
      }
    });
  },

  renderProfile: function(posts, comments, tips) {
    var renderTips = [];
    var renderComments = [];
    var renderPosts = [];
    for (var i = 0; i < tips.length; i++) {
      var tip = tips[i];
      renderTips.push(this.generateTip("tips" + i, tip));
    }
    for (var i = comments.length - 1 ; i >= 0; i--) {
      var comment = comments[i];
      comment.body = comment.comment;
      renderComments.push(
        <Comment key={"comments: " + i} comment={comment}/>
      );
    }
    for (var i = 0; i < posts.length; i++) {
      var post = posts[i];
      var tipped = false;
      renderPosts.push(
        <Post key={i}
              refKey={i}
              post={posts[i]} 
              tipped={tipped}
              network={this.props.network}
              user_id={this.props.address}
              wallet={this.state.wallet}
              blockchain={this.props.blockchain} />
      );
    }
    this.setState({
      posts: renderPosts,
      comments: renderComments,
      tips: renderTips,
      content: renderPosts,
      getProfileData: false
    });
  },

  generateTip: function(key, tip) {
    return (
      <Panel key={key}>
        <div>
          <div style={{float: "left"}}>
            <a href={"/profile?user=" + tip.tipper}>{tip.tipper}</a> tipped <a href={"/permalink?sha1=" + tip.post}>{tip.post}</a>
          </div>
          <div style={{float: "right", fontSize: "15px", fontWeight: "bold"}}>
            {postTime(tip.datetime)}
          </div>
        </div>
        <br />
        <div>
          <div className="tipPicture">
            <IDPicture size={50} user_id={tip.tipper}/>
          </div>

          <Glyphicon glyph='arrow-right' className="tipArrow"/>
        
          <div className="tipPicture">
            <IDPicture size={50} user_id={tip.owner}/>
          </div>
        </div>
        <br /> <br />
        <hr />
        <div>
          <p>Transaction ID: <a href={"https://www.blocktrail.com/tBTC/tx/" + tip.txid}>{tip.txid}</a></p>
        </div>
      </Panel>
    );
  },

  renderContent: function(type) {
    if (type === "posts" && (this.state.content !== this.state.posts)) {
      this.setState({
        content: this.state.posts
      });
    }
    else if (type === "comments" && (this.state.content !== this.state.comments)) {
      console.log(this.state.comments);
      this.setState({
        content: this.state.comments
      });
    }
    else if (type === "tips" && (this.state.content !== this.state.tips)) {
      this.setState({
        content: this.state.tips
      });
    }
  },

  render: function() {
    if (this.state.getProfileData) {
      return (
        <div className="container">
          <Panel>
            <center>Loading Profile</center>
          </Panel>
        </div>
      );
    }
    else {
      var balances;
      return (
        <div className="container">
          <Panel>
            <Row>
              <Col md={3} lg={3} xl={3}>
                <IDPicture user_id={this.props.address} />
              </Col>
              <Col md={9} lg={9} xl={9}>
                <h2>{this.props.address + "\'s Profile"}</h2>
                <h4>Wallet Balance: {this.state.balance}</h4>
                <h4>Bistore Balance: {this.state.bitstore_balance}</h4>
              </Col>
            </Row>
          </Panel>

          <Row>
            <Col md={3} lg={3} xl={3}>
              <Panel>
                <Nav className="profileOption" stacked>
                  <NavItem eventKey={1} onClick={this.renderContent.bind(null, "posts")}>
                    Posts
                  </NavItem>
                  <NavItem bsSeventKey={2} onClick={this.renderContent.bind(null, "comments")}>
                    Comments
                  </NavItem>
                  <NavItem eventKey={3} onClick={this.renderContent.bind(null, "tips")}>
                    Tips
                  </NavItem>
                </Nav>
              </Panel>
            </Col>
            <Col md={9} lg={9} xl={9}>
              {this.state.content}
            </Col>
          </Row>
        </div>
      );
    }
  }
});

module.exports = Profile;
