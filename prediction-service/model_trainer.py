import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score
import json


def load_match_data(filepath='matches.json'):

    with open(filepath, encoding='utf-8') as inputfile:
        matches = json.load(inputfile)

    df = pd.DataFrame(matches)
    df['date'] = pd.to_datetime(df['date'])

    df = df[(df['date'] < pd.Timestamp.now()) & (df['score'] != 'SCHEDULED')]

    df[['home_goals', 'away_goals']] = df['score'].apply(
        lambda x: pd.Series(x) if isinstance(x, list) else pd.Series([0, 0])
    )

    # W=1 (home win), D=2 (draw), L=0 (away win)
    def calculate_result(row):
        if row['home_goals'] > row['away_goals']:
            return 1
        elif row['home_goals'] < row['away_goals']:
            return 0
        else:
            return 2

    df['result'] = df.apply(calculate_result, axis=1)
    df = df.sort_values('date').reset_index(drop=True)

    return df


def calculate_ppg(df, team, date, window=10):
    """Calculate points per game for a team over the last N matches"""
    team_matches = df[
        ((df['home_team'] == team) | (df['away_team'] == team)) &
        (df['date'] < date)
    ].tail(window)

    if len(team_matches) == 0:
        return 1.0

    points = 0
    for _, match in team_matches.iterrows():
        if match['home_team'] == team:
            if match['result'] == 1:  # Home win
                points += 3
            elif match['result'] == 2:  # Draw
                points += 1
        else:
            if match['result'] == 0:  # Away win
                points += 3
            elif match['result'] == 2:  # Draw
                points += 1

    return points / len(team_matches)


def calculate_goals_stats(df, team, date, window=10):

    team_matches = df[
        ((df['home_team'] == team) | (df['away_team'] == team)) &
        (df['date'] < date)
    ].tail(window)

    if len(team_matches) == 0:
        return 0.0, 0.0, 0.0

    goals_scored = 0
    goals_conceded = 0

    for _, match in team_matches.iterrows():
        if match['home_team'] == team:
            goals_scored += match['home_goals']
            goals_conceded += match['away_goals']
        else:
            goals_scored += match['away_goals']
            goals_conceded += match['home_goals']

    avg_scored = goals_scored / len(team_matches)
    avg_conceded = goals_conceded / len(team_matches)
    goal_diff = avg_scored - avg_conceded

    return avg_scored, avg_conceded, goal_diff


def engineer_features(df, min_history=10):

    features_list = []

    for idx, row in df.iterrows():
        home_team = row['home_team']
        away_team = row['away_team']
        match_date = row['date']

        home_ppg = calculate_ppg(df, home_team, match_date, min_history)
        away_ppg = calculate_ppg(df, away_team, match_date, min_history)

        home_gs, home_gc, home_gd = calculate_goals_stats(df, home_team, match_date, min_history)
        away_gs, away_gc, away_gd = calculate_goals_stats(df, away_team, match_date, min_history)

        features_list.append({
            'date': match_date,
            'home_team': home_team,
            'away_team': away_team,
            'home_ppg': home_ppg,
            'away_ppg': away_ppg,
            'result': row['result'],
            'home_goals_scored_avg': home_gs,
            'home_goals_conceded_avg': home_gc,
            'away_goals_scored_avg': away_gs,
            'away_goals_conceded_avg': away_gc,
            'home_goal_diff': home_gd,
            'away_goal_diff': away_gd
        })

    features_df = pd.DataFrame(features_list)
    print(f"Features engineered: {len(features_df)} matches")

    return features_df


def create_team_encoding(features_df):

    all_teams = pd.concat([features_df['home_team'], features_df['away_team']]).unique()
    all_teams = [t for t in all_teams if t is not None]
    all_teams = sorted(all_teams)
    team_to_code = {team: idx for idx, team in enumerate(all_teams)}

    features_df['home_team_code'] = features_df['home_team'].map(team_to_code)
    features_df['away_team_code'] = features_df['away_team'].map(team_to_code)

    return features_df, team_to_code


def split_train_test(features_df, split_date='2025-03-01'):

    train = features_df[features_df['date'] < split_date]
    test = features_df[features_df['date'] >= split_date]

    print(f"\nTrain: {len(train)} matches (before {split_date})")
    print(f"Test: {len(test)} matches (from {split_date} onwards)")

    return train, test


def train_model(train_df, predictors, n_estimators=50, min_samples_split=10, random_state=42):
    
    # Train Random Forest Classifier
    print("\nTraining model...")
    rf = RandomForestClassifier(
        n_estimators=n_estimators,
        min_samples_split=min_samples_split,
        random_state=random_state
    )
    rf.fit(train_df[predictors], train_df['result'])
    print("Model trained successfully.")
    return rf


def main():
    
    df = load_match_data('matches.json')
    print(f"Loaded {len(df)} matches")

    features_df = engineer_features(df, min_history=10)
    features_df, team_to_code = create_team_encoding(features_df)

    train, test = split_train_test(features_df, split_date='2025-07-01')

    predictors = [
        'home_team_code',
        'away_team_code',
        'home_ppg',
        'away_ppg',
        'home_goal_diff',
        'away_goal_diff'
    ]
    model = train_model(train, predictors)

    if len(test) > 0:
        preds = model.predict(test[predictors])
        accuracy = accuracy_score(test['result'], preds)
        print(f"\nTest Accuracy: {accuracy:.3f}")

    return model, df, team_to_code


if __name__ == "__main__":
    model, df, team_to_code = main()
