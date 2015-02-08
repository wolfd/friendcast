"use strict";

module.exports = function(sequelize, DataTypes) {
  var Free = sequelize.define("Free", {
    fb_user_id: { type: DataTypes.STRING, unique: true, allowNull: false },
    start_time: { type: DataTypes.BIGINT, allowNull: false },
    end_time: { type: DataTypes.BIGINT, allowNull: false },
    blurb: { type: DataTypes.STRING, allowNull: false },
    done: DataTypes.BOOLEAN
  }, {
    classMethods: {
      associate: function(models) {
        Free.hasMany(models.Pending)
        Free.hasMany(models.Success)
      }
    }
  });

  return Free;
};
