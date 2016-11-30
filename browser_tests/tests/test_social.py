import pytest
from controllers import *


def test_send_follow_request_to_nonexistent_user():
    users = [guid(), guid()]
    sender, reciever = users

    # must fail
    with signup_to_homedir(username=sender, password=sender) as filesystem:
            with pytest.raises(Exception):
                filesystem.send_follow_request(reciever)

def test_send_and_accept_follow_request():
    pass

def test_send_and_accept_and_reciprocate_follow_request():
    pass

def test_send_and_deny_follow_request():
    pass


def test_share_folder():
    pass