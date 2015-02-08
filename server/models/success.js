"use strict";

module.exports = function(sequelize, DataTypes) {
  var Success = sequelize.define("Success", {
    fb_user_id: { type: DataTypes.STRING, unique: true, allowNull: false },
  }, {
    classMethods: {
      associate: function(models) {
        Success.belongsTo(models.Free)
      }
    }
  });

  return Success;
};
