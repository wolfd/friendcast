"use strict";

module.exports = function(sequelize, DataTypes) {
  var Pending = sequelize.define("Pending", {
    fb_user_id: { type: DataTypes.STRING, unique: true, allowNull: false },
  }, {
    classMethods: {
      associate: function(models) {
        Pending.belongsTo(models.Free)
      }
    }
  });

  return Pending;
};
