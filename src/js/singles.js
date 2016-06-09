var R = require("ramda");
var moment = require("moment");

module.exports = function (metaData, players, results) {

  function getStandings () {
    var base = R.reduce(function (acc, val) {
      acc[val] = {played: 0, wins: 0, for: 0, against: 0, diff: 0};
      return acc;
    }, {}, players);

    return R.pipe(
      R.reduce(function (acc, val) {
        var resultParts = R.split(",", val);
        var winner = resultParts[0];
        var loser = resultParts[1];
        var score = resultParts[2];

        var scoreParts = R.split("-", score);
        var fore = scoreParts[0];
        var against = scoreParts[1];

        acc[winner] = R.evolve({
          played: R.add(1),
          wins: R.add(1),
          for: R.add(fore),
          against: R.add(against)
        }, acc[winner]);

        acc[winner].diff = acc[winner].for - acc[winner].against;

        acc[loser] = R.evolve({
          played: R.add(1),
          wins: R.identity,
          for: R.add(against),
          against: R.add(fore)
        }, acc[loser]);

        acc[loser].diff = acc[loser].for - acc[loser].against;

        return acc;
      }, base),
      R.toPairs,
      R.map(function (pair) {
        return R.merge(pair[1], {name: pair[0]});
      }),
      R.sort(function (a, b) {
        return a["wins"] - b["wins"] || a["diff"] - b["diff"];
      }),
      R.reverse
    )(results);
  }

  function getAllResults () {
    return  R.pipe(
      R.reduce(function (acc, val) {
        var resultParts = R.split(",", val);
        var winner = resultParts[0];
        var loser = resultParts[1];
        var score = resultParts[2];
        var date = resultParts[3];

        if (!acc[date]) acc[date] = [];
        acc[date].push({winner: winner, loser: loser, score: score});

        return acc;
      }, {}),
      R.toPairs,
      R.map(function (pair) {
        return {
          date: moment(pair[0], "YYYYMMDD").format("MMMM Do YYYY"),
          results: pair[1]
        };
      }),
      R.reverse
    )(results);
  }

  function getPlayerBreakdowns () {
    var base = R.reduce(function (acc, val) {
      acc[val] = {yetToPlay: R.without([val], players), results: []};
      return acc;
    }, {}, players);

    return R.pipe(
      R.reduce(function (acc, val) {
        var resultParts = R.split(",", val);
        var winner = resultParts[0];
        var loser = resultParts[1];
        var score = resultParts[2];

        acc[winner] = R.evolve({
          results: R.prepend({winner: winner, loser: loser, score: score}),
          yetToPlay: R.without([loser])
        }, acc[winner]);

        acc[loser] = R.evolve({
          results: R.prepend({winner: winner, loser: loser, score: score}),
          yetToPlay: R.without([winner])
        }, acc[loser]);

        return acc;
      }, base),
      R.toPairs,
      R.map(function (pair) {
        return R.merge(pair[1], {name: pair[0]});
      })
    )(results);
  }

  function formatMetaData () {
    return R.merge(metaData, {
      startDate: (metaData.startDate) ? moment(metaData.startDate, "YYYY-MM-DD").format("MMMM Do YYYY") : null,
      endDate: (metaData.endDate) ? moment(metaData.endDate, "YYYY-MM-DD").format("MMMM Do YYYY") : null
    });
  }

  function validateResults () {
    var errors = [];

    var invalidPlayersInResults = R.pipe(
      R.reduce(function (acc, val) {
        var resultParts = R.split(",", val);
        var winner = resultParts[0];
        var loser = resultParts[1];

        return R.concat(acc, [winner, loser]);
      }, []),
      R.uniq,
      R.difference(R.__, players)
    )(results)

    if (invalidPlayersInResults.length) {
      invalidPlayersInResults.forEach(function (player) {
        errors.push("Player '" + player + "' in result for league '" + metaData.displayName + "' doesnt exist");
      })
    }

    var duplicateResults = R.pipe(
      R.reduce(function (acc, val) {
        var resultParts = R.split(",", val);
        var sortAsc = R.comparator(function (a, b) { return a < b});

        var key = R.pipe(
          R.take(2),
          R.sort(sortAsc),
          R.join(",")
        )(resultParts);

        if (!acc[key]) acc[key] = 0;
        acc[key] += 1;
        return acc;
      }, {}),
      R.toPairs,
      R.filter(function (result) {
        return result[1] > 1;
      }),
      R.map(R.head)
    )(results);

    if (duplicateResults.length) {
      duplicateResults.forEach(function (combination) {
        errors.push("Duplicate result found for combination: " + combination);
      })
    }

    return errors;
  }

  var errors = validateResults();

  if (errors.length) {
    throw new Error(JSON.stringify(errors[0]));
  } else {
    var leagueData = {
      resultsTotal: results.length,
      standings: getStandings(),
      allResults: getAllResults(),
      playerBreakdowns: getPlayerBreakdowns()
    };

    return R.mergeAll([
      formatMetaData(),
      leagueData
    ]);
  }
}
