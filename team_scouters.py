"""
Team 6897 Astraea Robotics - Scouter Account Data
This file contains all the predefined scouter accounts for the team.
Updated: October 2025
"""

import hashlib

def hash_password(password):
    """Hash a password using SHA256"""
    return hashlib.sha256(password.encode()).hexdigest()

TEAM_SCOUTERS = {
    # MECHANICAL
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
    'skukreja': {
        'username': 'skukreja',
        'password_hash': hash_password('Suday123'),
        'role': 'scouter',
        'name': 'Suday Kukreja'
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
    'lsingla': {
        'username': 'lsingla',
        'password_hash': hash_password('Lakshya456'),
        'role': 'scouter',
        'name': 'Lakshya Singla'
    },
    'nmudakalli': {
        'username': 'nmudakalli',
        'password_hash': hash_password('Nandan741'),
        'role': 'scouter',
        'name': 'Nandan Mudakalli'
    },
    'adalvi': {
        'username': 'adalvi',
        'password_hash': hash_password('Aahana369'),
        'role': 'scouter',
        'name': 'Aahana Dalvi'
    },
    'jbhinderwala': {
        'username': 'jbhinderwala',
        'password_hash': hash_password('Jameela823'),
        'role': 'scouter',
        'name': 'Jameela Bhinderwala'
    },
    'achowdhury': {
        'username': 'achowdhury',
        'password_hash': hash_password('Adrita951'),
        'role': 'scouter',
        'name': 'Adrita Chowdhury'
    },
    'khang': {
        'username': 'khang',
        'password_hash': hash_password('Kevin528'),
        'role': 'scouter',
        'name': 'Kevin Hang'
    },
    'pyoussef': {
        'username': 'pyoussef',
        'password_hash': hash_password('Paul357'),
        'role': 'scouter',
        'name': 'Paul Youssef'
    },
    'obarda': {
        'username': 'obarda',
        'password_hash': hash_password('Oz852'),
        'role': 'scouter',
        'name': 'Oz Barda'
    },
    'agani': {
        'username': 'agani',
        'password_hash': hash_password('Amruth482'),
        'role': 'scouter',
        'name': 'Amruth Gani'
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
    'aagarwal': {
        'username': 'aagarwal',
        'password_hash': hash_password('Aviral159'),
        'role': 'scouter',
        'name': 'Aviral Agarwal'
    },
    'skhanna': {
        'username': 'skhanna',
        'password_hash': hash_password('Siddharth753'),
        'role': 'scouter',
        'name': 'Siddharth Khanna'
    },
    'hkapasi': {
        'username': 'hkapasi',
        'password_hash': hash_password('Husain147'),
        'role': 'scouter',
        'name': 'Husain Kapasi'
    },
    'fnono': {
        'username': 'fnono',
        'password_hash': hash_password('Francisco258'),
        'role': 'scouter',
        'name': 'Francisco Nono'
    },
    'jgeorgi': {
        'username': 'jgeorgi',
        'password_hash': hash_password('Joel963'),
        'role': 'scouter',
        'name': 'Joel Georgi'
    },
    'jsingh': {
        'username': 'jsingh',
        'password_hash': hash_password('Jivraj417'),
        'role': 'scouter',
        'name': 'Jivraj Singh'
    },
    'ybhatnagar': {
        'username': 'ybhatnagar',
        'password_hash': hash_password('Yash321'),
        'role': 'scouter',
        'name': 'Yash Bhatnagar'
    },
    'isalam': {
        'username': 'isalam',
        'password_hash': hash_password('Ihsan639'),
        'role': 'scouter',
        'name': 'Ihsan Shebeer Salam'
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
    'oabu-zaydeh': {
        'username': 'oabu-zaydeh',
        'password_hash': hash_password('Omar528'),
        'role': 'scouter',
        'name': 'Omar Abu-Zaydeh'
    },
    'kshao': {
        'username': 'kshao',
        'password_hash': hash_password('Kenny741'),
        'role': 'scouter',
        'name': 'Kenny Shao'
    },
    'mwatkkins': {
        'username': 'mwatkkins',
        'password_hash': hash_password('Mark369'),
        'role': 'scouter',
        'name': 'Mark Watkkins'
    },
    'vgajawada': {
        'username': 'vgajawada',
        'password_hash': hash_password('Vedh852'),
        'role': 'scouter',
        'name': 'Vedh Gajawada'
    },
    'nthayil': {
        'username': 'nthayil',
        'password_hash': hash_password('Nivedh456'),
        'role': 'scouter',
        'name': 'Nivedh Thayil'
    },
    'avlha': {
        'username': 'avlha',
        'password_hash': hash_password('Andrew951'),
        'role': 'scouter',
        'name': 'Andrew Vlha'
    },
    'schen': {
        'username': 'schen',
        'password_hash': hash_password('Skyler357'),
        'role': 'scouter',
        'name': 'Skyler Chen'
    },
    'zarshad': {
        'username': 'zarshad',
        'password_hash': hash_password('Zain482'),
        'role': 'scouter',
        'name': 'Zain Arshad'
    },
    'njin': {
        'username': 'njin',
        'password_hash': hash_password('Noah285'),
        'role': 'scouter',
        'name': 'Noah Jin'
    },
    'akang': {
        'username': 'akang',
        'password_hash': hash_password('Akum654'),
        'role': 'scouter',
        'name': 'Akum Kang'
    },
    'seoon': {
        'username': 'seoon',
        'password_hash': hash_password('Sebastian789'),
        'role': 'scouter',
        'name': 'Sebastian Eoon'
    },
    'aawasthi': {
        'username': 'aawasthi',
        'password_hash': hash_password('Ahaan963'),
        'role': 'scouter',
        'name': 'Ahaan Awasthi'
    },
    'sdhall': {
        'username': 'sdhall',
        'password_hash': hash_password('Shubham147'),
        'role': 'scouter',
        'name': 'Shubham Dhall'
    },
    'pkaranth': {
        'username': 'pkaranth',
        'password_hash': hash_password('Prahlad258'),
        'role': 'scouter',
        'name': 'Prahlad Karanth'
    },
    'njosiah': {
        'username': 'njosiah',
        'password_hash': hash_password('Nathaniel417'),
        'role': 'scouter',
        'name': 'Nathaniel Josiah'
    },
    'eeristavi': {
        'username': 'eeristavi',
        'password_hash': hash_password('Elene963'),
        'role': 'scouter',
        'name': 'Elene Eristavi'
    },
    'kkalinkina': {
        'username': 'kkalinkina',
        'password_hash': hash_password('Katherine639'),
        'role': 'scouter',
        'name': 'Katherine Kalinkina'
    },
    'amohan': {
        'username': 'amohan',
        'password_hash': hash_password('Arnav528'),
        'role': 'scouter',
        'name': 'Arnav Mohan'
    },
    'fhussain': {
        'username': 'fhussain',
        'password_hash': hash_password('Faiz741'),
        'role': 'scouter',
        'name': 'Faiz Hussain'
    },
    'rverma': {
        'username': 'rverma',
        'password_hash': hash_password('Reva369'),
        'role': 'scouter',
        'name': 'Reva Verma'
    },
    'achen': {
        'username': 'achen',
        'password_hash': hash_password('Adrian852'),
        'role': 'scouter',
        'name': 'Adrian Chen'
    },
    'abarai': {
        'username': 'abarai',
        'password_hash': hash_password('Alishu456'),
        'role': 'scouter',
        'name': 'Alishu Barai'
    },
    'psomani': {
        'username': 'psomani',
        'password_hash': hash_password('Pradyum951'),
        'role': 'scouter',
        'name': 'Pradyum Somani'
    },
    
    # PROGRAMMING
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
    'dbalaraman': {
        'username': 'dbalaraman',
        'password_hash': hash_password('Divyashree357'),
        'role': 'scouter',
        'name': 'Divyashree Balaraman'
    },
    'jsharma': {
        'username': 'jsharma',
        'password_hash': hash_password('Jivin174'),
        'role': 'scouter',
        'name': 'Jivin Sharma'
    },
    'asrinivasan': {
        'username': 'asrinivasan',
        'password_hash': hash_password('Arjun482'),
        'role': 'scouter',
        'name': 'Arjun Srinivasan'
    },
    'nchoudhury': {
        'username': 'nchoudhury',
        'password_hash': hash_password('Neel654'),
        'role': 'scouter',
        'name': 'Neel Choudhury'
    },
    'jzeeshan': {
        'username': 'jzeeshan',
        'password_hash': hash_password('Jibrael789'),
        'role': 'scouter',
        'name': 'Jibrael Zeeshan'
    },
    
    # BUSINESS
    'ccastillo': {
        'username': 'ccastillo',
        'password_hash': hash_password('Carina963'),
        'role': 'scouter',
        'name': 'Carina Castillo'
    },
    'jleber': {
        'username': 'jleber',
        'password_hash': hash_password('Jack417'),
        'role': 'scouter',
        'name': 'Jack Leber'
    },
    'ayan': {
        'username': 'ayan',
        'password_hash': hash_password('Alison147'),
        'role': 'scouter',
        'name': 'Alison Yan'
    },
    'nshah': {
        'username': 'nshah',
        'password_hash': hash_password('Nikita258'),
        'role': 'scouter',
        'name': 'Nikita Shah'
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
    'bdewoud': {
        'username': 'bdewoud',
        'password_hash': hash_password('Bebo741'),
        'role': 'scouter',
        'name': 'Bebo Dewoud'
    },
    'spandya': {
        'username': 'spandya',
        'password_hash': hash_password('Snigdha852'),
        'role': 'scouter',
        'name': 'Snigdha Pandya'
    },
}

PASSWORD_REFERENCE = {
    # MECHANICAL
    'Arjun Debnath': 'Arjun159',
    'Brooklyn Kienle': 'Brooklyn753',
    'Sohum Bhardwaj': 'Sohum258',
    'Suday Kukreja': 'Suday123',
    'Ruby Portnoy': 'Ruby456',
    'Yashvi Parikh': 'Yashvi789',
    'Lakshya Singla': 'Lakshya456',
    'Nandan Mudakalli': 'Nandan741',
    'Aahana Dalvi': 'Aahana369',
    'Jameela Bhinderwala': 'Jameela823',
    'Adrita Chowdhury': 'Adrita951',
    'Kevin Hang': 'Kevin528',
    'Paul Youssef': 'Paul357',
    'Oz Barda': 'Oz852',
    'Amruth Gani': 'Amruth482',
    'Oliver Grasberger-Dorman': 'Oliver369',
    'Andrew Rabinovich': 'Andrew396',
    'Mohammud Bhuiyan': 'Mohammud654',
    'Gordon He': 'Gordon852',
    'Aviral Agarwal': 'Aviral159',
    'Siddharth Khanna': 'Siddharth753',
    'Husain Kapasi': 'Husain147',
    'Francisco Nono': 'Francisco258',
    'Joel Georgi': 'Joel963',
    'Jivraj Singh': 'Jivraj417',
    'Yash Bhatnagar': 'Yash321',
    'Ihsan Shebeer Salam': 'Ihsan639',
    'Aditya Naren': 'Aditya396',
    'Swarit Gupta': 'Swarit174',
    'Ishan Dasgupta': 'Ishan147',
    'Zahi Obaidulla': 'Zahi963',
    'Thomas Sorial': 'Thomas963',
    'Brandon Ruggiero': 'Brandon285',
    'Omar Abu-Zaydeh': 'Omar528',
    'Kenny Shao': 'Kenny741',
    'Mark Watkkins': 'Mark369',
    'Vedh Gajawada': 'Vedh852',
    'Nivedh Thayil': 'Nivedh456',
    'Andrew Vlha': 'Andrew951',
    'Skyler Chen': 'Skyler357',
    'Zain Arshad': 'Zain482',
    'Noah Jin': 'Noah285',
    'Akum Kang': 'Akum654',
    'Sebastian Eoon': 'Sebastian789',
    'Ahaan Awasthi': 'Ahaan963',
    'Shubham Dhall': 'Shubham147',
    'Prahlad Karanth': 'Prahlad258',
    'Nathaniel Josiah': 'Nathaniel417',
    'Elene Eristavi': 'Elene963',
    'Katherine Kalinkina': 'Katherine639',
    'Arnav Mohan': 'Arnav528',
    'Faiz Hussain': 'Faiz741',
    'Reva Verma': 'Reva369',
    'Adrian Chen': 'Adrian852',
    'Alishu Barai': 'Alishu456',
    'Pradyum Somani': 'Pradyum951',
    
    # PROGRAMMING
    'Ritika Annamaneni': 'Ritika741',
    'Anshika Pradhan': 'Anshika417',
    'Katherine Wang': 'Katherine528',
    'Rafaela Sepulveda': 'Rafaela639',
    'Divyashree Balaraman': 'Divyashree357',
    'Jivin Sharma': 'Jivin174',
    'Arjun Srinivasan': 'Arjun482',
    'Neel Choudhury': 'Neel654',
    'Jibrael Zeeshan': 'Jibrael789',
    
    # BUSINESS
    'Carina Castillo': 'Carina963',
    'Jack Leber': 'Jack417',
    'Alison Yan': 'Alison147',
    'Nikita Shah': 'Nikita258',
    'Caitlyn Laury': 'Caitlyn528',
    'Aathmika Dutta': 'Aathmika639',
    'Bebo Dewoud': 'Bebo741',
    'Snigdha Pandya': 'Snigdha852',
}

def get_team_scouters():
    """Return the team scouters dictionary"""
    return TEAM_SCOUTERS

def get_password_reference():
    """Return the password reference for easy distribution"""
    return PASSWORD_REFERENCE

def print_credentials():
    """Print all credentials in a readable format"""
    print("\n" + "="*70)
    print("TEAM 6897 ASTRAEA ROBOTICS - SCOUTER CREDENTIALS")
    print("="*70)
    
    sections = {
        'MECHANICAL': [
            'Arjun Debnath', 'Brooklyn Kienle', 'Sohum Bhardwaj', 'Suday Kukreja',
            'Ruby Portnoy', 'Yashvi Parikh', 'Lakshya Singla', 'Nandan Mudakalli',
            'Aahana Dalvi', 'Jameela Bhinderwala', 'Adrita Chowdhury', 'Kevin Hang',
            'Paul Youssef', 'Oz Barda', 'Amruth Gani', 'Oliver Grasberger-Dorman',
            'Andrew Rabinovich', 'Mohammud Bhuiyan', 'Gordon He', 'Aviral Agarwal',
            'Siddharth Khanna', 'Husain Kapasi', 'Francisco Nono', 'Joel Georgi',
            'Jivraj Singh', 'Yash Bhatnagar', 'Ihsan Shebeer Salam', 'Aditya Naren',
            'Swarit Gupta', 'Ishan Dasgupta', 'Zahi Obaidulla', 'Thomas Sorial',
            'Brandon Ruggiero', 'Omar Abu-Zaydeh', 'Kenny Shao', 'Mark Watkkins',
            'Vedh Gajawada', 'Nivedh Thayil', 'Andrew Vlha', 'Skyler Chen',
            'Zain Arshad', 'Noah Jin', 'Akum Kang', 'Sebastian Eoon',
            'Ahaan Awasthi', 'Shubham Dhall', 'Prahlad Karanth', 'Nathaniel Josiah',
            'Elene Eristavi', 'Katherine Kalinkina', 'Arnav Mohan', 'Faiz Hussain',
            'Reva Verma', 'Adrian Chen', 'Alishu Barai', 'Pradyum Somani'
        ],
        'PROGRAMMING': [
            'Ritika Annamaneni', 'Anshika Pradhan', 'Katherine Wang', 'Rafaela Sepulveda',
            'Divyashree Balaraman', 'Jivin Sharma', 'Arjun Srinivasan', 'Neel Choudhury',
            'Jibrael Zeeshan'
        ],
        'BUSINESS': [
            'Carina Castillo', 'Jack Leber', 'Alison Yan', 'Nikita Shah',
            'Caitlyn Laury', 'Aathmika Dutta', 'Bebo Dewoud', 'Snigdha Pandya'
        ]
    }
    
    for section, names in sections.items():
        print(f"\n{section}")
        print("-" * 70)
        print(f"{'Name':<30} {'Username':<25} {'Password':<15}")
        print("-" * 70)
        
        for name in names:
            if name in PASSWORD_REFERENCE:
                password = PASSWORD_REFERENCE[name]
                username = None
                for user_data in TEAM_SCOUTERS.values():
                    if user_data['name'] == name:
                        username = user_data['username']
                        break
                
                if username:
                    print(f"{name:<30} {username:<25} {password:<15}")
    
    print("\n" + "="*70)
    print(f"Total Scouters: {len(TEAM_SCOUTERS)}")
    print("="*70)

if __name__ == "__main__":
    print_credentials()