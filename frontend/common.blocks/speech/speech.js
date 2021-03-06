modules.define(
    'speech',
    ['i-bem__dom', 'BEMHTML', 'i-store', 'list', 'notify', 'events__channels', 'speechkit', 'lodash', 'difflib', 'vow'],
    function(provide, BEMDOM, BEMHTML, Store, List, Notify, channels, speechkit, _, difflib, vow){
        var API_KEY = 'f92ce291-973b-44e0-afa5-c77e17715be0';

        var ACTION_QUESTIONS = {
            'write-message' : 'Произнесите текст сообщения для отправки',
            'open-channel' : 'Произнесите название канала',
            'open-in' : 'Произнесите ник или ФИО собеседника',
            'exit' : 'Уверены?'
        };

        var COMMANDS_MESSAGES = [
            { action : 'write-message', commands : ['отправить сообщение', 'ввести сообщение', 'набрать сообщение', 'напечатать сообщение', 'новое сообщение'] },
            { action : 'open-channel', commands : ['открыть канал', 'войти в канал'] },
            { action : 'open-in', commands : ['открыть приватную беседу', 'выбрать собеседника'] },
            { action : 'exit', commands : ['выйти', 'выход', 'разлогиниться', 'логаут'] }
        ];

        provide(BEMDOM.decl(this.name, {
            onSetMod : {
                'js' : {
                    'inited' : function(){
                        this.bindTo('click', this._handleClick.bind(this));
                    }
                }
            },

            /**
             * Обработка клика
             *
             * @private
             */
            _handleClick : function(){
                this._requestSpeech()
                    .then(this._firstCommand)
                    .then(this._secondCommand.bind(this))
                    .then(this._emitAction.bind(this))
                    .catch(function(error){
                        Notify.error(error, 'Ошибка голосового управления');
                    })
                    .always(function(){
                        this.delMod('loading');
                    }.bind(this));
            },

            /**
             * Первый запрос для распознавания типа действия
             *
             * @param {String} text
             * @returns {Promise|String}
             * @private
             */
            _firstCommand : function(text){
                var action;

                text = text.trim().toLowerCase();

                _.find(COMMANDS_MESSAGES, function(message){
                    _.find(message.commands, function(command){
                        var similarity = new difflib.SequenceMatcher(null, command, text).quickRatio();

                        if(similarity > 0.85){
                            action = message.action;

                            return true;
                        }
                    });
                });

                if(!action){
                    throw new Error('Команда не найдена');
                }else{
                    return action;
                }

            },

            /**
             * Запуск второго запроса после распознавания типа действия
             *
             * @param {String} action - действие
             * @returns {Promise}
             * @private
             */
            _secondCommand : function(action){
                this._action = action;

                return this._requestSpeech(ACTION_QUESTIONS[action]);
            },

            /**
             * Генерация БЭМ-события
             *
             * @param {String} text
             * @private
             */
            _emitAction : function(text){
                this.emit(this._action, { text : text });
            },

            /**
             * Запрос к Yandex SpeechKit https://speechkit.yandex.ru/dev/solutions/cloud
             *
             * @param {String} [command='Произнесите команду'] - Текст команды
             * @param {String} [model='freeform'] - Модель данных для распознавания
             * @returns {Promise}
             * @private
             */
            _requestSpeech : function(command, model){
                command = command || 'Произнесите команду';
                model = model || 'freeform';

                this.setMod('loading');

                return new vow.Promise(function(resolve, reject){
                    speechkit.recognize({
                        model : model,
                        lang : 'ru-RU',
                        apiKey : API_KEY,

                        doneCallback : function(text){
                            resolve(text);
                        },

                        initCallback : function(){
                            Notify.info(command);
                        },

                        errorCallback : function(){
                            throw new Error('Ошибка при распознавании команды');
                        }
                    });
                });
            }
        }));
    }
);
