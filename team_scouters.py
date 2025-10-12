"""
Team 6897 Astraea Robotics - Scouter Account Data
This file contains all the predefined scouter accounts for the team.
"""

import hashlib

def hash_password(password):
    """Hash a password using SHA256"""
    return hashlib.sha256(password.encode()).hexdigest()

TEAM_SCOUTERS = {
    'skukreja': {
        'username': 'skukreja',
        'password_hash': hash_password('Suday123'),
        'role': 'scouter',
        'name': 'Suday Kukreja'
    },
    'jbhinderwala': {
        'username': 'jbhinderwala',
        'password_hash': hash_password('Jameela823'),
        'role': 'scouter',
        'name': 'Jameela Bhinderwala'
    },
    'lsingla': {
        'username': 'lsingla',
        'password_hash': hash_password('Lakshya456'),
        'role': 'scouter',
        'name': 'Lakshya Singla'
    },
    'khang': {
        'username': 'khang',
        'password_hash': hash_password('Kevin528'),
        'role': 'scouter',
        'name': 'Kevin Hang'
    },
    'obarda': {
        'username': 'obarda',
        'password_hash': hash_password('Oz852'),
        'role': 'scouter',
        'name': 'Oz Barda'
    },
    'ograsberger-dorman': {
        'username': 'ograsberger-dorman',
        'password_hash': hash_password('Oliver369'),
        'role': 'scouter',
        'name': 'Oliver Grasberger-Dorman'
    },
    'arabinovich': {
        'username': 'arabinovich',
        'password_hash': hash_password('Andrew396'),
        'role': 'scouter',
        'name': 'Andrew Rabinovich'
    },
    'mbhuiyan': {
        'username': 'mbhuiyan',
        'password_hash': hash_password('Mohammud654'),
        'role': 'scouter',
        'name': 'Mohammud Bhuiyan'
    },
    'ghe': {
        'username': 'ghe',
        'password_hash': hash_password('Gordon852'),
        'role': 'scouter',
        'name': 'Gordon He'
    },
    'ybhatnagar': {
        'username': 'ybhatnagar',
        'password_hash': hash_password('Yash321'),
        'role': 'scouter',
        'name': 'Yash Bhatnagar'
    },
    'anaren': {
        'username': 'anaren',
        'password_hash': hash_password('Aditya396'),
        'role': 'scouter',
        'name': 'Aditya Naren'
    },
    'sgupta': {
        'username': 'sgupta',
        'password_hash': hash_password('Swarit174'),
        'role': 'scouter',
        'name': 'Swarit Gupta'
    },
    'idasgupta': {
        'username': 'idasgupta',
        'password_hash': hash_password('Ishan147'),
        'role': 'scouter',
        'name': 'Ishan Dasgupta'
    },
    'zobaidulla': {
        'username': 'zobaidulla',
        'password_hash': hash_password('Zahi963'),
        'role': 'scouter',
        'name': 'Zahi Obaidulla'
    },
    'tsorial': {
        'username': 'tsorial',
        'password_hash': hash_password('Thomas963'),
        'role': 'scouter',
        'name': 'Thomas Sorial'
    },
    'bruggerio': {
        'username': 'bruggerio',
        'password_hash': hash_password('Brandon285'),
        'role': 'scouter',
        'name': 'Brandon Ruggiero'
    },
    'njin': {
        'username': 'njin',
        'password_hash': hash_password('Noah285'),
        'role': 'scouter',
        'name': 'Noah Jin'
    },
    'eeristavi': {
        'username': 'eeristavi',
        'password_hash': hash_password('Elene963'),
        'role': 'scouter',
        'name': 'Elene Eristavi'
    },
    'rannamaneni': {
        'username': 'rannamaneni',
        'password_hash': hash_password('Ritika741'),
        'role': 'scouter',
        'name': 'Ritika Annamaneni'
    },
    'apradhan': {
        'username': 'apradhan',
        'password_hash': hash_password('Anshika417'),
        'role': 'scouter',
        'name': 'Anshika Pradhan'
    },
    'kwang': {
        'username': 'kwang',
        'password_hash': hash_password('Katherine528'),
        'role': 'scouter',
        'name': 'Katherine Wang'
    },
    'rsepulveda': {
        'username': 'rsepulveda',
        'password_hash': hash_password('Rafaela639'),
        'role': 'scouter',
        'name': 'Rafaela Sepulveda'
    },
    'jsharma': {
        'username': 'jsharma',
        'password_hash': hash_password('Jivin174'),
        'role': 'scouter',
        'name': 'Jivin Sharma'
    },
    'amandala': {
        'username': 'amandala',
        'password_hash': hash_password('Aarush285'),
        'role': 'scouter',
        'name': 'Aarush Mandala'
    },
    'gsupan': {
        'username': 'gsupan',
        'password_hash': hash_password('Gabrielle396'),
        'role': 'scouter',
        'name': 'Gabrielle Supan'
    },
    'jleber': {
        'username': 'jleber',
        'password_hash': hash_password('Jack417'),
        'role': 'scouter',
        'name': 'Jack Leber'
    },
    'claury': {
        'username': 'claury',
        'password_hash': hash_password('Caitlyn528'),
        'role': 'scouter',
        'name': 'Caitlyn Laury'
    },
    'adutta': {
        'username': 'adutta',
        'password_hash': hash_password('Aathmika639'),
        'role': 'scouter',
        'name': 'Aathmika Dutta'
    },
    'spandya': {
        'username': 'spandya',
        'password_hash': hash_password('Snigdha852'),
        'role': 'scouter',
        'name': 'Snigdha Pandya'
    },

    'adebnath': {
        'username': 'adebnath',
        'password_hash': hash_password('Arjun159'),
        'role': 'scouter',
        'name': 'Arjun Debnath'
    },
    'bkienle': {
        'username': 'bkienle',
        'password_hash': hash_password('Brooklyn753'),
        'role': 'scouter',
        'name': 'Brooklyn Kienle'
    },
    'sbhardwaj': {
        'username': 'sbhardwaj',
        'password_hash': hash_password('Sohum258'),
        'role': 'scouter',
        'name': 'Sohum Bhardwaj'
    },
    'rportnoy': {
        'username': 'rportnoy',
        'password_hash': hash_password('Ruby456'),
        'role': 'scouter',
        'name': 'Ruby Portnoy'
    },
    'yparikh': {
        'username': 'yparikh',
        'password_hash': hash_password('Yashvi789'),
        'role': 'scouter',
        'name': 'Yashvi Parikh'
    },
}

PASSWORD_REFERENCE = {
    'Suday Kukreja': 'Suday123',
    'Jameela Bhinderwala': 'Jameela823',
    'Lakshya Singla': 'Lakshya456',
    'Kevin Hang': 'Kevin528',
    'Oz Barda': 'Oz852',
    'Oliver Grasberger-Dorman': 'Oliver369',
    'Andrew Rabinovich': 'Andrew396',
    'Mohammud Bhuiyan': 'Mohammud654',
    'Gordon He': 'Gordon852',
    'Yash Bhatnagar': 'Yash321',
    'Aditya Naren': 'Aditya396',
    'Swarit Gupta': 'Swarit174',
    'Ishan Dasgupta': 'Ishan147',
    'Zahi Obaidulla': 'Zahi963',
    'Thomas Sorial': 'Thomas963',
    'Brandon Ruggiero': 'Brandon285',
    'Noah Jin': 'Noah285',
    'Elene Eristavi': 'Elene963',
    'Ritika Annamaneni': 'Ritika741',
    'Anshika Pradhan': 'Anshika417',
    'Katherine Wang': 'Katherine528',
    'Rafaela Sepulveda': 'Rafaela639',
    'Jivin Sharma': 'Jivin174',
    'Aarush Mandala': 'Aarush285',
    'Gabrielle Supan': 'Gabrielle396',
    'Jack Leber': 'Jack417',
    'Caitlyn Laury': 'Caitlyn528',
    'Aathmika Dutta': 'Aathmika639',
    'Snigdha Pandya': 'Snigdha852',
    'Arjun Debnath': 'Arjun159',
    'Brooklyn Kienle': 'Brooklyn753',
    'Sohum Bhardwaj': 'Sohum258',
    'Ruby Portnoy': 'Ruby456',
    'Yashvi Parikh': 'Yashvi789'
}

def get_team_scouters():
    """Return the team scouters dictionary"""
    return TEAM_SCOUTERS

def get_password_reference():
    """Return the password reference for easy distribution"""
    return PASSWORD_REFERENCE

def print_credentials():
    """Print all credentials in a readable format"""
    print("\n" + "="*60)
    print("TEAM 6897 ASTRAEA ROBOTICS - SCOUTER CREDENTIALS")
    print("="*60)
    print(f"{'Name':<25} {'Username':<20} {'Password':<15}")
    print("-"*60)
    
    for name, password in PASSWORD_REFERENCE.items():
        username = None
        for user_data in TEAM_SCOUTERS.values():
            if user_data['name'] == name:
                username = user_data['username']
                break
        
        if username:
            print(f"{name:<25} {username:<20} {password:<15}")
    
    print("="*60)
    print(f"Total Scouters: {len(TEAM_SCOUTERS)}")
    print("="*60)

if __name__ == "__main__":
    print_credentials()
