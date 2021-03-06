/**
 * IndexPageController
 *
 * @description :: Server-side logic for managing indexpages
 * @help        :: See http://links.sailsjs.org/docs/controllers
 */

module.exports = {

    /**
     * `IndexPageController.index()`
     */
    index : function(req, res){

        res.render({
            data : {
                title : 'Shriming chat',
                user : req.session.User || null
            }
        });

    }
};
