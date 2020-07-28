import pytest
from controllers import *


@pytest.mark.skip
def test_send_follow_request_to_nonexistent_user_fails():
    users = [randomUsername(), randomUsername()]
    sender, receiver = users

    with signup_to_homedir(username=sender, password=sender) as filesystem:
        # must fail since receiver doesn't exist
        filesystem.send_follow_request(receiver)
        follow_request_sent = filesystem.d.find_elements_by_xpath("//h3[text()='{}']".format('Follow request sent!'))
        assert len(follow_request_sent) == 0


@pytest.mark.skip
def _send_follow_request():
    # signup two users
    sender, receiver = randomUsername(), randomUsername()

    for user in [sender, receiver]:
        with signup_to_homedir(username=user, password=user):
            pass

    # send follow request from sender to receiver
    with login_to_homedir(sender, sender) as driver:
        driver.send_follow_request(receiver)

    return sender, receiver


@pytest.mark.skip
def test_send_and_accept_follow_request():
    sender, receiver = _send_follow_request()

    # receiver has pending follow request from sender
    with login_to_homedir(receiver, receiver) as driver:
        pending_follow_requests = driver.get_pending_follow_request()
        assert pending_follow_requests == [sender]

    with login_to_homedir(receiver, receiver) as driver:
        driver.accept_follow_request(sender)

    # receiver has sender as a follower
    with login_to_homedir(receiver, receiver) as driver:

        followers = driver.get_followers()
        assert followers == [sender]

    # sender does not have receiver as a follower
    with login_to_homedir(sender, sender) as driver:
        # has sender directory in root
        root_dir_page = driver.go_home()
        assert root_dir_page.d.find_element_by_id(receiver)

    followers = driver.get_followers()
    assert followers == []


@pytest.mark.skip
def test_send_and_deny_follow_request():
    sender, receiver = _send_follow_request()

    # deny follow request
    with login_to_homedir(receiver, receiver) as driver:
        driver.deny_follow_request(sender)

    # no pending requests
    with login_to_homedir(receiver, receiver) as driver:
        assert driver.get_pending_follow_request() == []

    # sender and receiver have no followers
    for user in [sender, receiver]:
        with login_to_homedir(user, user) as driver:
            followers = driver.get_followers()
            assert followers == []


@pytest.mark.skip
def test_send_and_accept_and_reciprocate_follow_request():
    sender, receiver = _send_follow_request()

    with login_to_homedir(receiver, receiver) as driver:
        driver.accept_follow_request_and_follow_back(sender)

    # receiver has sender as a follower
    with login_to_homedir(receiver, receiver) as driver:
        followers = driver.get_followers()
        assert followers == [sender]

    # sender has receiver as a follower
    with login_to_homedir(sender, sender) as driver:
        followers = driver.get_followers()
        assert followers == [receiver]
