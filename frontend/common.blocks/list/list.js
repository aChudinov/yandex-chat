modules.define(
    'list',
    ['i-bem__dom', 'BEMHTML', 'jquery', 'i-chat-api', 'i-store', 'notify', 'events__channels', 'keyboard__codes', 'editable-title'],
    function(provide, BEMDOM, BEMHTML, $, chatAPI, Store, Notify, channels, keyCodes, EditableTitle){

        provide(BEMDOM.decl(this.name, {
            onSetMod : {
                'js' : {
                    'inited' : function(){
                        var instances = this.__self.instances || (this.__self.instances = []);
                        instances.push(this);

                        this._container = this.elem('container');
                        this._spinBlock = this.findBlockInside('spin');

                        if(this._spinBlock) {
                            this._spinBlock.setMod('visible');
                        }

                        var shrimingEvents = channels('shriming-events');

                        Store.on('users-loaded', this._initializeLists, this);

                        shrimingEvents.on('channel-received-message', this._handleNewMessage, this);

                        EditableTitle.on('channel-change-title', this._onChannelChangeTitle, this);

                        if(this.hasMod('type', 'channels')) {
                            this._initCreateNewChannelButton();
                        }
                    }
                }
            },

            _handleNewMessage : function(e, data){
                var counter = this._getItemCounter(data.channelId);

                if(counter) {
                    counter.text(Number(counter.text()) + 1);
                }

                this.dropElemCache('item');
            },

            /**
             * Получаем каналы и итерируемся по каждому с целью
             * простановки счетчика непрочитнных сообщений
             *
             * @param {String} channelId - ID канала
             * @returns {Object|null} - Элемент counter счетчика непрочитанных сообщений канала
             *
             * @private
             */
            _getItemCounter : function(channelId){
                var _this = this;
                var counterElem;

                this.elem('item').each(function(index, item){
                    var itemParams = _this.elemParams($(item));

                    if(itemParams.channelId === channelId) {
                        counterElem = $(_this.findElem('counter')[index]);
                    }
                });

                return counterElem ? counterElem : null;
            },

            _initializeLists : function(){
                var _this = this;

                switch (this.getMod('type')) {
                    case 'channels':
                        Store.fetchChannels().then(function(){
                            _this._renderChannels();
                        });

                        break;

                    case 'users':
                        chatAPI.on('rtm.start', function(result){
                            var usersStatusOnStart = {};

                            result.users.forEach(function(user){
                                usersStatusOnStart[user.id] = user.presence;
                            });

                            Store.fetchIms().then(function(){
                                _this._renderIms(usersStatusOnStart);
                            });
                        });
                        break;

                    case 'conference':
                        break;

                    default:

                }
            },

            _renderChannels : function(){
                var channels = Store.getChannels();
                var generalChannelIndex;
                var hashChannelIndex;
                var selectedChannel;

                var channelsList = channels.map(function(channel, index){
                    if(channel.is_general) {
                        generalChannelIndex = index;
                    }

                    if(channel.name == location.hash.slice(1)) {
                        hashChannelIndex = index;
                    }

                    return BEMHTML.apply({
                        block : 'list',
                        elem : 'item',
                        mods : { type : 'channels' },
                        content : channel.name,
                        js : {
                            channelId : channel.id,
                            name : channel.name,
                            title : channel.topic.value
                        }
                    });
                });

                BEMDOM.update(this._container, channelsList);

                selectedChannel = this._container.children()[hashChannelIndex || generalChannelIndex];

                if(selectedChannel) {
                    selectedChannel.click();
                }

                this._spinBlock.delMod('visible');
            },

            _renderIms : function(usersStatusOnStart){
                var pageBlock = this.findBlockOutside('page');
                var ims = Store.getIms();

                var imsList = ims.map(function(im){
                    var user = Store.getUser(im.user);

                    if(!user) {
                        return;
                    }

                    var presence = usersStatusOnStart[user.id];
                    if(presence) {
                        user.presence = usersStatusOnStart[user.id];
                    }

                    return BEMHTML.apply({
                        block : 'list',
                        elem : 'item',
                        mods : { type : 'users' },
                        js : {
                            channelId : im.id,
                            name : user.name,
                            title : user.real_name
                        },
                        content : {
                            block : 'user',
                            js : {
                                id : user.id
                            },
                            mods : { presence : user.presence },
                            user : {
                                name : user.name,
                                realName : user.real_name,
                                image_48 : user.profile.image_48
                            }
                        }
                    });
                });

                BEMDOM.update(this._container, imsList);
                updateUsersStatus('activeUsersUpdated', pageBlock._activeUsersUpdated);
                this._spinBlock.delMod('visible');

                function updateUsersStatus(name, data){
                    this.findBlocksInside('user').forEach(function(user){
                        switch (name) {
                            case 'activeUsersUpdated':
                                if(data[user.params.id]) {
                                    user.setMod('presence', 'local');
                                }else if(user.hasMod('presence', 'local')) {
                                    chatAPI.get('users.getPresence', { user : user.params.id }).then(function(data){
                                        if(data.ok) {
                                            user.setMod('presence', data.presence);
                                        }
                                    });
                                }

                                break;

                            case 'presence_change':
                                if(user.params.id == data.user && !user.hasMod('presence', 'local')) {
                                    user.setMod('presence', data.presence);
                                }

                                break;

                            default:

                        }
                    });
                }

                pageBlock.on('activeUsersUpdated', function(e, data){
                    updateUsersStatus('activeUsersUpdated', data);
                });

                chatAPI.on('presence_change', function(data){
                    updateUsersStatus('presence_change', data);
                });
            },

            _initCreateNewChannelButton : function(){
                this._createChannelButton = this.findBlockInside('button');
                this._createChannelInput = this.findBlockInside('add-channel-input', 'input');

                this._createChannelButton.on('click', function(){
                    this.toggleMod(this.elem('add-channel-input'), 'visible');
                    this._createChannelInput.setMod('focused');

                    this.toggleMod(this.elem('addition'), 'open');
                }, this);

                this._createChannelInput.domElem.on('keydown', function(e){
                    if(e.keyCode === keyCodes.ENTER) {
                        e.preventDefault();
                        this._createChannel(e.target.value);
                    }
                }.bind(this));
            },

            _createChannel : function(){
                var channelName = this._createChannelInput.getVal();
                if(!channelName.length) {
                    return Notify.error('Введите название канала!');
                }

                this._spinBlock.setMod('visible');
                this.delMod(this.elem('add-channel-input'), 'visible');
                var _this = this;
                chatAPI.post('channels.create', { name : channelName })
                    .then(function(response){
                        if(!response.ok) {
                            switch (response.error) {
                                case 'name_taken':
                                    Notify.error('Такое имя канала уже существует!');
                                    break;
                                case 'restricted_action':
                                    Notify.error('Вам запрещено создавать новые каналы!');
                                    break;
                                case 'no_channel':
                                    Notify.error('Имя канала не может быть пустым и должно состоять из букв и цифр!');
                                    break;
                                default:
                                    Notify.error('Ошибка создания канала!');
                            }
                            return;
                        }
                        Notify.success('Канал успешно создан!');
                        _this._createChannelInput.setVal('');
                        _this.dropElemCache('item');
                        _this._initializeLists();
                    })
                    .always(function(){
                        _this._spinBlock.delMod('visible');
                        _this.setMod(_this.elem('add-channel-input'), 'visible');
                    });
            },

            _onItemClick : function(e){
                var item = $(e.currentTarget);
                var type = this.getMod(item, 'type');
                var counter = this._getItemCounter(this.elemParams(item).channelId);

                if(type == 'channels'){
                    location.hash = e.target.innerText;
                }

                if(counter) {
                    counter.text('');
                }

                this.__self.instances.forEach(function(list){
                    list.delMod(list.elem('item'), 'current');
                });

                this.setMod(item, 'current', true);
                this.emit('click-' + type, this.elemParams(item));
                this.dropElemCache('item');
            },

            _onChannelChangeTitle : function(e, data){
                var currentItem = $(this.elem('item_current'));

                if(!currentItem.length) {
                    return;
                }

                var params = $.extend({}, this.elemParams(currentItem));
                params.title = data.newTitle;

                BEMDOM.replace(currentItem, BEMHTML.apply({
                    block : 'list',
                    elem : 'item',
                    mods : { type : 'channels', current : true },
                    content : params.name,
                    js : params
                }));

                this.dropElemCache('item');
            }
        }, {
            live : function(){
                this.liveBindTo('item', 'click', function(e){
                    this._onItemClick(e);
                });

                return false;
            }
        }));
    }
);
